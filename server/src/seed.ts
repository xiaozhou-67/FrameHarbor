import { db } from './db.ts';
import { config } from './config.ts';

const films = [
  [
    '极光之外',
    'BEYOND THE AURORA',
    '科幻',
    128,
    '林照',
    ['程野', '许遥'],
    'aurora',
    '#7de2cc',
    9.1,
    'now',
    '当一座沿海城市的夜空出现永不落幕的极光，年轻的气象研究员与失联多年的父亲，沿着一段来自深海的信号重新相遇。一场关于时间、记忆与归途的旅程就此展开。',
  ],
  [
    '潮汐来信',
    'LETTERS FROM THE TIDE',
    '剧情',
    112,
    '陈知夏',
    ['沈川', '周予'],
    'tide',
    '#a6c8ec',
    8.8,
    'now',
    '一位回到故乡的邮递员，在废弃灯塔中发现一箱寄往未来的信件。他决定替陌生人完成最后一次投递，也在潮水之间找回与家人告别的方式。',
  ],
  [
    '环轨漫游',
    'ORBIT WANDERERS',
    '冒险',
    136,
    '何星原',
    ['江屿', '叶青'],
    'orbit',
    '#e8b986',
    8.6,
    'now',
    '停运的星际环轨列车意外启动，三位互不相识的乘客被带往航图之外。他们必须在下一次日出前找到回程的轨道，却发现沿途每一站都藏着自己的往事。',
  ],
  [
    '森林电台',
    'FOREST RADIO',
    '动画',
    98,
    '温小满',
    ['鹿小南', '熊阿树'],
    'forest',
    '#b6d39a',
    9.3,
    'now',
    '一只害怕说话的小鹿经营着森林里唯一的深夜电台。当暴风雪让所有小路消失，它和伙伴们用声音搭起一条回家的路。献给每一个认真倾听世界的孩子。',
  ],
  [
    '回声走廊',
    'THE ECHO CORRIDOR',
    '悬疑',
    119,
    '顾远',
    ['梁序', '莫白'],
    'echo',
    '#d4a6b9',
    8.4,
    'now',
    '旧剧院修复师每晚都会听见一段尚未发生的对话。当舞台重新亮起，那些被隐藏的真相开始通过一面镜子逐一显影。最后一场演出，观众也成为故事的一部分。',
  ],
  [
    '岛屿日记',
    'AN ISLAND DIARY',
    '纪录',
    94,
    '苏禾',
    ['海岛居民'],
    'island',
    '#7fcbc1',
    8.9,
    'now',
    '摄制组在一座小岛上生活了四季，记录渔民、教师、返乡青年与迁徙候鸟的日常。没有宏大的叙事，只有海风、厨房的灯火，以及人与土地之间绵长的联系。',
  ],
  [
    '追光少年',
    'CHASING THE LIGHT',
    '剧情',
    108,
    '徐远山',
    ['李知', '张乐'],
    'light',
    '#f0cc86',
    8.7,
    'soon',
    '县城中学的电影社团只有一台旧放映机。为了让最后一场露天电影顺利上映，四个少年踏上一段穿越山谷的公路旅程，也第一次认真思考各自想去的远方。',
  ],
  [
    '月球便利店',
    'MOONLIGHT MART',
    '动画',
    103,
    '刘映',
    ['兔店长', '机器人零'],
    'moon',
    '#b8abed',
    9.0,
    'soon',
    '月球背面有一家二十四小时营业的便利店，为迷路的宇航员出售故乡的味道。新来的机器人店员发现，最珍贵的商品从来没有标价。',
  ],
] as const;

export function seedDemo() {
  if (config.SEED_DEMO !== 'true' || db.get<{ n: number }>('SELECT COUNT(*) n FROM movies')?.n) return;
  db.transaction(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    for (const [index, film] of films.entries()) {
      const [title, english, genre, duration, director, cast, art, accent, score, status, synopsis] = film;
      const release =
        status === 'soon' ? new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) : today;
      db.run(
        `INSERT INTO movies(title,english_title,genre,duration_minutes,language,release_date,synopsis,director,cast_json,poster,accent,status,featured,editorial_score)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        title,
        english,
        genre,
        duration,
        '国语 / 中文字幕',
        release,
        synopsis,
        director,
        JSON.stringify(cast),
        `/art/${art}.svg`,
        accent,
        status,
        index === 0 ? 1 : 0,
        score,
      );
    }
    const cinemas = [
      [
        '帧港影城 · 滨江艺术中心',
        '杭州',
        '滨江区',
        '闻涛路 168 号艺术中心 3F',
        ['杜比全景声', '江景休息区', '免费停车'],
        '沿江而建的城市光影客厅。舒适座椅与精心调校的声音，让每一场电影都有值得记住的细节。',
      ],
      [
        '帧港影城 · 西湖书院',
        '杭州',
        '西湖区',
        '文三路 66 号书院广场 5F',
        ['IMAX', '独立影展', '咖啡吧'],
        '在书与电影之间停留。以精选片单与舒适观影空间，连接城市中每一个热爱故事的人。',
      ],
      [
        '帧港影城 · 江湾里',
        '上海',
        '杨浦区',
        '大学路 218 号江湾里 B1',
        ['CINITY', '亲子友好', '地铁直达'],
        '街角的光影聚点，为忙碌生活留一段慢下来的时间。提供丰富格式影厅及家庭观影场次。',
      ],
    ] as const;
    for (const c of cinemas) {
      const result = db.run(
        'INSERT INTO cinemas(name,city,district,address,tags_json,description) VALUES(?,?,?,?,?,?)',
        c[0],
        c[1],
        c[2],
        c[3],
        JSON.stringify(c[4]),
        c[5],
      );
      const cinemaId = Number(result.lastInsertRowid);
      for (let h = 0; h < 2; h++)
        db.run(
          'INSERT INTO halls(cinema_id,name,format,rows_count,columns_count) VALUES(?,?,?,?,?)',
          cinemaId,
          `${h + 1} 号厅`,
          h === 0 ? '杜比全景声' : cinemaId === 2 ? 'IMAX' : '激光 2D',
          8,
          12,
        );
    }
    const halls = db.all<{ id: number }>('SELECT id FROM halls');
    for (let day = 0; day < 7; day++) {
      const date = new Date(Date.now() + day * 86400000).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Shanghai',
      });
      for (const hall of halls) {
        for (let slot = 0; slot < 4; slot++) {
          const movieId = ((hall.id + slot + day - 1) % 6) + 1;
          const duration = db.get<{ duration: number }>(
            'SELECT duration_minutes duration FROM movies WHERE id=?',
            movieId,
          )!.duration;
          const starts = Date.parse(`${date}T${String(10 + slot * 3).padStart(2, '0')}:00:00+08:00`);
          if (starts <= Date.now() + 15 * 60000) continue;
          db.run(
            'INSERT INTO shows(movie_id,hall_id,starts_at,ends_at,price_cents) VALUES(?,?,?,?,?)',
            movieId,
            hall.id,
            starts,
            starts + duration * 60000,
            3900 + (hall.id % 3) * 1000 + slot * 300,
          );
        }
      }
    }
  });
}
