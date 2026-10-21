// Source inspection only: never import server, shared or frontend application modules.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse, compileTemplate, compileStyle } from '@vue/compiler-sfc';

const root = fileURLToPath(new URL('../', import.meta.url));
const skipped = new Set(['node_modules', '.git', 'dist', 'data']);
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    skipped.has(entry.name)
      ? []
      : entry.isDirectory()
        ? walk(join(directory, entry.name))
        : [join(directory, entry.name)],
  );
}
const files = walk(root);
const errors = [];
let imports = 0;
let templates = 0;
let assets = 0;
let apiCalls = 0;
let sqlStatements = 0;
let stylesheets = 0;
const relativeName = (path) => relative(root, path).replaceAll('\\', '/');
const fail = (path, message) => errors.push(`${relativeName(path)}: ${message}`);
for (const path of files.filter((p) => extname(p) === '.json')) {
  try {
    JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(path, 'Invalid JSON');
  }
}
const endpoints = [];
for (const name of ['auth', 'admin', 'catalog', 'community', 'ticketing']) {
  const source = readFileSync(join(root, 'server/src', `${name}.ts`), 'utf8');
  for (const match of source.matchAll(/\b\w+Router\.(get|post|put|delete)\('([^']+)'/g))
    endpoints.push({
      method: match[1].toUpperCase(),
      path: (['auth', 'admin'].includes(name) ? `/${name}` : '') + match[2],
    });
}
function routeCompatible(request, route) {
  const a = request.split('/');
  const b = route.split('/');
  return (
    a.length === b.length &&
    a.every((segment, i) => segment === '__PARAM__' || b[i]?.startsWith(':') || segment === b[i])
  );
}
function apiPath(node) {
  if (ts.isStringLiteralLike(node)) return node.text.split('?')[0];
  if (!ts.isTemplateExpression(node)) return null;
  let result = node.head.text;
  for (const span of node.templateSpans) {
    if (result.includes('?')) break;
    const expr = span.expression;
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'query')
      result += '?';
    else result += '__PARAM__';
    result += span.literal.text;
  }
  return result.split('?')[0];
}
function inspectScript(path, source) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const diagnostic of ast.parseDiagnostics)
    fail(path, ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
  function visit(node) {
    let specifier;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifier = node.moduleSpecifier.text;
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      specifier = node.arguments[0].text;
    if (specifier?.startsWith('.')) {
      imports++;
      const target = resolve(dirname(path), specifier);
      if (!existsSync(target) || !statSync(target).isFile()) fail(path, `Missing import: ${specifier}`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(ast) === 'db' &&
      ['get', 'all', 'run'].includes(node.expression.name.text) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      !node.arguments.some(ts.isSpreadElement)
    ) {
      const placeholders = (node.arguments[0].text.match(/\?/g) ?? []).length;
      sqlStatements++;
      if (placeholders !== node.arguments.length - 1)
        fail(
          path,
          `SQL binding mismatch: ${placeholders} placeholders, ${node.arguments.length - 1} arguments`,
        );
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'api' &&
      node.arguments[0]
    ) {
      const request = apiPath(node.arguments[0]);
      if (request?.startsWith('/') && request !== '/__PARAM__') {
        const options = node.arguments[1];
        let methods = ['GET'];
        if (options && ts.isObjectLiteralExpression(options)) {
          const property = options.properties.find(
            (p) => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'method',
          );
          if (property && ts.isPropertyAssignment(property)) {
            if (ts.isStringLiteral(property.initializer)) methods = [property.initializer.text];
            else if (ts.isConditionalExpression(property.initializer))
              methods = [property.initializer.whenTrue, property.initializer.whenFalse]
                .filter(ts.isStringLiteral)
                .map((v) => v.text);
            else methods = [];
          }
        }
        for (const method of methods) {
          apiCalls++;
          if (!endpoints.some((e) => e.method === method && routeCompatible(request, e.path)))
            fail(path, `No API contract: ${method} ${request}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
for (const path of files.filter(
  (p) => /\.(ts|vue|css)$/.test(p) && !p.includes(`${join(root, 'node_modules')}`),
)) {
  const source = readFileSync(path, 'utf8');
  if (extname(path) === '.vue') {
    const result = parse(source, { filename: path });
    for (const error of result.errors) fail(path, String(error));
    for (const block of [result.descriptor.script, result.descriptor.scriptSetup])
      if (block) inspectScript(path, block.content);
    if (result.descriptor.template) {
      templates++;
      const resultTemplate = compileTemplate({
        filename: path,
        id: relativeName(path),
        source: result.descriptor.template.content,
        compilerOptions: { expressionPlugins: ['typescript'] },
      });
      for (const error of resultTemplate.errors) fail(path, String(error));
    }
  } else if (extname(path) === '.ts') inspectScript(path, source);
  else if (extname(path) === '.css') {
    stylesheets++;
    const css = compileStyle({ filename: path, id: 'static-audit', source });
    for (const error of css.errors) fail(path, String(error));
  }
  for (const match of source.matchAll(/\/art\/[a-z]+\.svg/g)) {
    assets++;
    if (!existsSync(join(root, 'web/public', match[0]))) fail(path, `Missing asset: ${match[0]}`);
  }
  if (/\b(?:TODO|FIXME)\b|v-html\s*=|\beval\s*\(|new Function\s*\(/.test(source))
    fail(path, 'Unfinished placeholder or unsafe code pattern');
}
for (const art of ['aurora', 'tide', 'orbit', 'forest', 'echo', 'island', 'light', 'moon', 'panorama']) {
  const path = join(root, 'web/public/art', `${art}.svg`);
  if (!existsSync(path)) fail(path, 'Required artwork missing');
  else {
    const svg = readFileSync(path, 'utf8');
    if (
      !svg.startsWith('<svg') ||
      !svg.trim().endsWith('</svg>') ||
      /<script|<foreignObject|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg)
    )
      fail(path, 'Invalid or externally dependent SVG');
  }
}
for (const required of [
  'server/schema.sql',
  'README.md',
  '.env.example',
  'LICENSE',
  'web/public/license.txt',
  'docs/API.md',
  'docs/ACCEPTANCE.md',
  'docs/ORIGIN.md',
]) {
  if (!existsSync(join(root, required))) fail(join(root, required), 'Required deliverable missing');
}
if (existsSync(join(root, 'data')) || existsSync(join(root, 'dist')))
  errors.push('Runtime data or build output found; this delivery is static-only.');
console.log(
  JSON.stringify(
    {
      status: errors.length ? 'FAIL' : 'PASS',
      files: files.length,
      relativeImports: imports,
      vueTemplates: templates,
      localAssetReferences: assets,
      apiCallsChecked: apiCalls,
      apiEndpoints: endpoints.length,
      sqlStatementsChecked: sqlStatements,
      stylesheetsParsed: stylesheets,
      errors,
    },
    null,
    2,
  ),
);
process.exitCode = errors.length ? 1 : 0;
