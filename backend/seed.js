require('dotenv').config();
const mongoose = require('mongoose');
const Character = require('./src/models/Character');

// 女性人物列表（其余默认 male）
const FEMALE_NAMES = new Set([
  '武则天', '李清照', '慈禧', '圣女贞德', '南丁格尔', '居里夫人', '特蕾莎修女',
]);

// 轻量数据：仅含姓名、简介、朝代（dynasty）
// background / works / knowledgeBoundary 留空，用户首次点击时由 AI 动态生成并永久缓存
const characters = [
  // ── 国内 · 先秦 ─────────────────────────────────
  { name: '孔子',   description: '儒家创始人，中国最伟大的思想家、教育家', dynasty: '先秦' },
  { name: '孟子',   description: '儒家"亚圣"，仁政思想的重要倡导者', dynasty: '先秦' },
  { name: '老子',   description: '道家创始人，《道德经》作者', dynasty: '先秦' },
  { name: '庄子',   description: '道家代表人物，先秦诸子中的寓言大师', dynasty: '先秦' },
  { name: '墨子',   description: '墨家创始人，提倡兼爱、非攻', dynasty: '先秦' },
  { name: '孙子',   description: '著名军事家，《孙子兵法》作者', dynasty: '先秦' },
  { name: '韩非子', description: '法家集大成者，法治思想家', dynasty: '先秦' },
  { name: '商鞅',   description: '战国时期秦国变法改革家，法家代表人物', dynasty: '先秦' },
  { name: '屈原',   description: '楚国爱国诗人，《离骚》作者', dynasty: '先秦' },
  { name: '荀子',   description: '儒家思想家，主张"性恶论"', dynasty: '先秦' },
  { name: '管仲',   description: '春秋第一相，辅佐齐桓公称霸', dynasty: '先秦' },
  { name: '范蠡',   description: '越国大夫，助勾践复国后弃官经商', dynasty: '先秦' },
  { name: '吴起',   description: '战国著名军事家、政治改革家', dynasty: '先秦' },
  { name: '苏秦',   description: '纵横家，主持六国合纵抗秦', dynasty: '先秦' },
  { name: '伍子胥', description: '春秋末期吴国重臣、军事家', dynasty: '先秦' },

  // ── 国内 · 秦汉 ─────────────────────────────────
  { name: '秦始皇', description: '中国第一位皇帝，统一六国，建立中央集权制', dynasty: '秦汉' },
  { name: '项羽',   description: '楚汉之争中的西楚霸王，悲剧英雄', dynasty: '秦汉' },
  { name: '刘邦',   description: '汉朝开国皇帝汉高祖，布衣建立大汉', dynasty: '秦汉' },
  { name: '汉武帝', description: '西汉第七位皇帝，开拓丝绸之路，奠定汉族文化', dynasty: '秦汉' },
  { name: '张良',   description: '汉初三杰之一，运筹帷幄的谋圣', dynasty: '秦汉' },
  { name: '韩信',   description: '汉初三杰之一，杰出军事统帅，兵仙', dynasty: '秦汉' },
  { name: '司马迁', description: '西汉史学家，《史记》作者，"史圣"', dynasty: '秦汉' },
  { name: '张骞',   description: '西汉外交家、探险家，出使西域开辟丝绸之路', dynasty: '秦汉' },
  { name: '张衡',   description: '东汉科学家，发明地动仪，精通天文数学', dynasty: '秦汉' },
  { name: '蔡伦',   description: '东汉宦官，改进造纸术，影响人类文明进程', dynasty: '秦汉' },

  // ── 国内 · 三国 ─────────────────────────────────
  { name: '曹操',   description: '三国时期著名政治家、军事家、文学家', dynasty: '三国' },
  { name: '刘备',   description: '蜀汉开国皇帝，以仁义著称', dynasty: '三国' },
  { name: '孙权',   description: '东吴开国皇帝，善于用人守业', dynasty: '三国' },
  { name: '诸葛亮', description: '蜀汉丞相，鞠躬尽瘁的智圣', dynasty: '三国' },
  { name: '关羽',   description: '蜀汉大将，忠义化身，民间尊为"武圣"', dynasty: '三国' },
  { name: '周瑜',   description: '东吴名将，赤壁之战主帅，才华横溢', dynasty: '三国' },
  { name: '司马懿', description: '曹魏权臣，晋朝实际奠基人', dynasty: '三国' },
  { name: '赵云',   description: '蜀汉名将，常胜将军，忠勇无双', dynasty: '三国' },

  // ── 国内 · 两晋南北朝 ───────────────────────────
  { name: '王羲之',   description: '东晋书法家，"书圣"，著《兰亭序》', dynasty: '两晋南北朝' },
  { name: '陶渊明',   description: '东晋田园诗人，"不为五斗米折腰"', dynasty: '两晋南北朝' },
  { name: '祖冲之',   description: '南朝数学家、天文学家，精确计算圆周率到小数点后七位', dynasty: '两晋南北朝' },
  { name: '范缜',     description: '南朝哲学家，著《神灭论》，反对佛教灵魂不灭说', dynasty: '两晋南北朝' },
  { name: '刘义庆',   description: '南朝宋宗室，编著《世说新语》', dynasty: '两晋南北朝' },

  // ── 国内 · 隋唐 ─────────────────────────────────
  { name: '隋炀帝', description: '隋朝第二位皇帝，开凿大运河，功过颇具争议', dynasty: '隋唐' },
  { name: '唐太宗', description: '唐朝第二位皇帝，贞观之治缔造者，一代明君', dynasty: '隋唐' },
  { name: '武则天', description: '中国历史上唯一正统女皇帝', dynasty: '隋唐' },
  { name: '唐玄宗', description: '唐朝盛世之主，开元盛世缔造者', dynasty: '隋唐' },
  { name: '李白',   description: '唐代浪漫主义诗人，"诗仙"', dynasty: '隋唐' },
  { name: '杜甫',   description: '唐代现实主义诗人，"诗圣"', dynasty: '隋唐' },
  { name: '王维',   description: '唐代诗人、画家，"诗佛"，山水田园诗宗师', dynasty: '隋唐' },
  { name: '白居易', description: '唐代著名诗人，新乐府运动倡导者', dynasty: '隋唐' },
  { name: '韩愈',   description: '唐代文学家、思想家，古文运动领袖', dynasty: '隋唐' },
  { name: '柳宗元', description: '唐代文学家，与韩愈并称"韩柳"', dynasty: '隋唐' },
  { name: '玄奘',   description: '唐代高僧，西天取经，翻译佛经，著《大唐西域记》', dynasty: '隋唐' },
  { name: '鉴真',   description: '唐代高僧，六次东渡日本传播中华文化', dynasty: '隋唐' },
  { name: '李靖',   description: '唐朝开国名将、军事家，民间神话中托塔天王原型', dynasty: '隋唐' },
  { name: '颜真卿', description: '唐代书法家，创"颜体"楷书，忠烈之臣', dynasty: '隋唐' },
  { name: '魏征',   description: '唐太宗名臣，以直言敢谏著称的贤相', dynasty: '隋唐' },

  // ── 国内 · 宋 ──────────────────────────────────
  { name: '赵匡胤', description: '宋朝开国皇帝，陈桥兵变，杯酒释兵权', dynasty: '宋' },
  { name: '欧阳修', description: '北宋文学家、政治家，唐宋八大家之一', dynasty: '宋' },
  { name: '王安石', description: '北宋政治家、文学家，推行变法改革', dynasty: '宋' },
  { name: '苏轼',   description: '北宋文学家，诗词书画皆绝，唐宋八大家之一', dynasty: '宋' },
  { name: '司马光', description: '北宋史学家，编著《资治通鉴》', dynasty: '宋' },
  { name: '岳飞',   description: '南宋军事家，精忠报国的民族英雄', dynasty: '宋' },
  { name: '李清照', description: '宋代女词人，婉约派代表，"千古第一才女"', dynasty: '宋' },
  { name: '辛弃疾', description: '南宋词人、抗金将领，豪放派代表', dynasty: '宋' },
  { name: '陆游',   description: '南宋爱国诗人，留下大量忧国忧民诗篇', dynasty: '宋' },
  { name: '朱熹',   description: '南宋理学集大成者，程朱理学代表人物', dynasty: '宋' },
  { name: '文天祥', description: '南宋末年政治家，宁死不降，著《正气歌》', dynasty: '宋' },
  { name: '沈括',   description: '北宋科学家，著《梦溪笔谈》，百科全书式学者', dynasty: '宋' },

  // ── 国内 · 元 ──────────────────────────────────
  { name: '忽必烈', description: '元朝开国皇帝，建立统一的多民族国家', dynasty: '元' },
  { name: '关汉卿', description: '元代著名剧作家，《窦娥冤》作者，"元曲四大家"之首', dynasty: '元' },
  { name: '郭守敬', description: '元代天文学家、水利工程专家，编制《授时历》', dynasty: '元' },
  { name: '赵孟頫', description: '元代书法家、画家，楷书四大家之一', dynasty: '元' },
  { name: '元好问', description: '金末元初文学家，号遗山，金代文学最杰出代表', dynasty: '元' },

  // ── 国内 · 明 ──────────────────────────────────
  { name: '朱元璋', description: '明朝开国皇帝洪武帝，布衣出身建立大明', dynasty: '明' },
  { name: '朱棣',   description: '明成祖，迁都北京，五次亲征漠北', dynasty: '明' },
  { name: '郑和',   description: '明代航海家，七下西洋，展示大明国威', dynasty: '明' },
  { name: '王阳明', description: '明代哲学家，心学集大成者，兼为军事家', dynasty: '明' },
  { name: '张居正', description: '明代著名政治家，主持万历新政，推行一条鞭法', dynasty: '明' },
  { name: '李时珍', description: '明代医药学家，著《本草纲目》', dynasty: '明' },
  { name: '戚继光', description: '明代军事家，抗倭名将，著《纪效新书》', dynasty: '明' },
  { name: '海瑞',   description: '明代著名清官，刚直不阿，敢于直言', dynasty: '明' },
  { name: '徐光启', description: '明代科学家、政治家，引进西方科学技术', dynasty: '明' },
  { name: '唐寅',   description: '明代著名画家、诗人，"江南四大才子"之一', dynasty: '明' },
  { name: '徐霞客', description: '明代旅行家、地理学家，著《徐霞客游记》', dynasty: '明' },
  { name: '冯梦龙', description: '明代通俗文学家，编撰"三言二拍"', dynasty: '明' },

  // ── 国内 · 清 ──────────────────────────────────
  { name: '康熙',   description: '清朝第四位皇帝，在位61年，奠定大清基业', dynasty: '清' },
  { name: '雍正',   description: '清朝第五位皇帝，以勤政著称，推行改革', dynasty: '清' },
  { name: '乾隆',   description: '清朝第六位皇帝，文治武功兼备，自号"十全老人"', dynasty: '清' },
  { name: '曹雪芹', description: '清代小说家，《红楼梦》作者', dynasty: '清' },
  { name: '林则徐', description: '清代政治家，虎门销烟，抵御外侮', dynasty: '清' },
  { name: '龚自珍', description: '清代思想家、文学家，近代启蒙先驱', dynasty: '清' },
  { name: '左宗棠', description: '清代政治家、军事家，率军收复新疆', dynasty: '清' },
  { name: '曾国藩', description: '清代政治家、军事家，湘军创始人', dynasty: '清' },
  { name: '李鸿章', description: '清代重臣，洋务运动领袖，北洋大臣', dynasty: '清' },
  { name: '慈禧',   description: '清朝最后的实际掌权者，垂帘听政近半世纪', dynasty: '清' },
  { name: '纪晓岚', description: '清代学者、文学家，《四库全书》总纂官', dynasty: '清' },
  { name: '和珅',   description: '清朝乾隆年间第一权臣，历史上著名的贪腐典型', dynasty: '清' },
  { name: '袁崇焕', description: '明末清初守辽将领，抗击后金的悲剧英雄', dynasty: '清' },

  // ── 国内 · 近代 ─────────────────────────────────
  { name: '孙中山', description: '近代民主革命先行者，中华民国国父', dynasty: '近代' },
  { name: '鲁迅',   description: '近代文学家、思想家，新文化运动旗手', dynasty: '近代' },
  { name: '梁启超', description: '近代思想家、政治家，维新变法运动领袖', dynasty: '近代' },
  { name: '蔡元培', description: '近代教育家，北大校长，推进新文化运动', dynasty: '近代' },
  { name: '詹天佑', description: '近代工程师，主持修建京张铁路，中国铁路之父', dynasty: '近代' },

  // ── 国外 · 古希腊罗马 ───────────────────────────
  { name: '荷马',         description: '古希腊诗人，《伊利亚特》与《奥德赛》的传说作者', dynasty: '' },
  { name: '毕达哥拉斯',   description: '古希腊数学家、哲学家，毕达哥拉斯定理发现者', dynasty: '' },
  { name: '苏格拉底',     description: '古希腊哲学家，西方哲学奠基人，以"产婆术"著称', dynasty: '' },
  { name: '柏拉图',       description: '苏格拉底的学生，理念论创立者，西方哲学最重要思想家之一', dynasty: '' },
  { name: '亚里士多德',   description: '古希腊哲学家，百科全书式的学者，亚历山大大帝的老师', dynasty: '' },
  { name: '阿基米德',     description: '古希腊伟大的数学家、物理学家，杠杆原理与浮力定律发现者', dynasty: '' },
  { name: '亚历山大大帝', description: '马其顿国王，建立横跨欧亚非的庞大帝国', dynasty: '' },
  { name: '凯撒',         description: '古罗马军事家、政治家，"我来我见我征服"', dynasty: '' },
  { name: '屋大维',       description: '古罗马第一位皇帝，开创罗马帝国两百年盛世', dynasty: '' },
  { name: '西塞罗',       description: '古罗马哲学家、政治家、演说家', dynasty: '' },
  { name: '欧几里得',     description: '古希腊数学家，《几何原本》作者，欧式几何奠基人', dynasty: '' },
  { name: '希波克拉底',   description: '古希腊医学家，"医学之父"，誓言沿用至今', dynasty: '' },
  { name: '修昔底德',     description: '古希腊历史学家，《伯罗奔尼撒战争史》作者', dynasty: '' },
  { name: '赫罗多德',     description: '古希腊历史学家，"历史学之父"', dynasty: '' },
  { name: '马可·奥勒留',  description: '古罗马皇帝兼斯多葛派哲学家，著《沉思录》', dynasty: '' },

  // ── 国外 · 中世纪 ───────────────────────────────
  { name: '查理曼',         description: '法兰克王国国王，加冕为西罗马帝国皇帝，"欧洲之父"', dynasty: '' },
  { name: '萨拉丁',         description: '埃及苏丹，收复耶路撒冷，十字军东征时代的主要对手', dynasty: '' },
  { name: '托马斯·阿奎那', description: '中世纪意大利神学家、哲学家，经院哲学集大成者', dynasty: '' },
  { name: '但丁',           description: '意大利诗人，《神曲》作者，意大利文学之父', dynasty: '' },
  { name: '成吉思汗',       description: '蒙古帝国奠基人，建立史上最大连续陆地帝国', dynasty: '' },
  { name: '马可·波罗',      description: '意大利旅行家，将东方文明介绍给欧洲', dynasty: '' },
  { name: '圣女贞德',       description: '法国民族女英雄，领导法军在百年战争中逆转局势', dynasty: '' },
  { name: '伊本·西那',      description: '波斯医学家、哲学家，《医典》作者，"医学王子"', dynasty: '' },

  // ── 国外 · 文艺复兴/大航海 ──────────────────────
  { name: '达芬奇',    description: '意大利文艺复兴巨匠，画家、科学家、发明家', dynasty: '' },
  { name: '米开朗基罗', description: '意大利文艺复兴雕塑家、画家，西斯廷礼拜堂壁画创作者', dynasty: '' },
  { name: '拉斐尔',    description: '意大利文艺复兴画家，文艺复兴三杰之一', dynasty: '' },
  { name: '哥伦布',    description: '意大利航海家，发现美洲新大陆', dynasty: '' },
  { name: '麦哲伦',    description: '葡萄牙航海家，率队完成人类首次环球航行', dynasty: '' },
  { name: '哥白尼',    description: '波兰天文学家，日心说的提出者', dynasty: '' },
  { name: '伽利略',    description: '意大利物理学家、天文学家，近代科学之父', dynasty: '' },
  { name: '马丁·路德', description: '德国神学家，宗教改革运动发起者', dynasty: '' },
  { name: '莎士比亚',  description: '英国戏剧家、诗人，《哈姆雷特》《罗密欧与朱丽叶》作者', dynasty: '' },
  { name: '塞万提斯',  description: '西班牙作家，《堂吉诃德》作者，近代小说之父', dynasty: '' },
  { name: '开普勒',    description: '德国天文学家，发现行星运动三大定律', dynasty: '' },
  { name: '伊拉斯谟',  description: '荷兰人文主义学者，文艺复兴时期重要思想家', dynasty: '' },

  // ── 国外 · 启蒙时代 ─────────────────────────────
  { name: '培根',    description: '英国哲学家，经验主义哲学先驱，"知识就是力量"', dynasty: '' },
  { name: '笛卡尔',  description: '法国哲学家、数学家，"我思故我在"，解析几何创始人', dynasty: '' },
  { name: '莱布尼茨', description: '德国哲学家、数学家，独立发明微积分', dynasty: '' },
  { name: '洛克',    description: '英国哲学家，自由主义与社会契约论奠基人', dynasty: '' },
  { name: '牛顿',    description: '英国物理学家，经典力学奠基人，万有引力定律发现者', dynasty: '' },
  { name: '卢梭',    description: '法国启蒙思想家，社会契约论提出者，浪漫主义先驱', dynasty: '' },
  { name: '伏尔泰',  description: '法国启蒙思想家、文学家，主张理性与宗教宽容', dynasty: '' },
  { name: '孟德斯鸠', description: '法国启蒙思想家，三权分立理论奠基人', dynasty: '' },
  { name: '康德',    description: '德国哲学家，批判哲学体系创立者，"哥白尼式革命"', dynasty: '' },
  { name: '巴赫',    description: '德国作曲家，巴洛克音乐最伟大的代表', dynasty: '' },
  { name: '莫扎特',  description: '奥地利作曲家，古典主义音乐天才', dynasty: '' },
  { name: '拿破仑',  description: '法国皇帝，军事天才，推动欧洲近代化进程', dynasty: '' },
  { name: '华盛顿',  description: '美国第一任总统，独立战争领袖，美国国父', dynasty: '' },
  { name: '富兰克林', description: '美国开国元勋、科学家，发明避雷针', dynasty: '' },
  { name: '贝多芬',  description: '德国音乐家，古典与浪漫主义音乐的桥梁', dynasty: '' },

  // ── 国外 · 19世纪 ───────────────────────────────
  { name: '黑格尔',         description: '德国哲学家，辩证法体系集大成者', dynasty: '' },
  { name: '叔本华',         description: '德国哲学家，悲观主义哲学代表，意志哲学奠基人', dynasty: '' },
  { name: '达尔文',         description: '英国生物学家，自然选择进化论提出者', dynasty: '' },
  { name: '马克思',         description: '德国哲学家、政治经济学家，《资本论》作者', dynasty: '' },
  { name: '法拉第',         description: '英国物理学家，发现电磁感应定律，电磁学奠基人', dynasty: '' },
  { name: '麦克斯韦',       description: '英国物理学家，建立电磁场方程，预言电磁波', dynasty: '' },
  { name: '巴斯德',         description: '法国微生物学家，近代微生物学奠基人，疫苗先驱', dynasty: '' },
  { name: '南丁格尔',       description: '英国护理事业创始人，"提灯女士"，近代护理学创始人', dynasty: '' },
  { name: '林肯',           description: '美国第16任总统，废除奴隶制，维护国家统一', dynasty: '' },
  { name: '俾斯麦',         description: '德国政治家，统一德意志的"铁血宰相"', dynasty: '' },
  { name: '托尔斯泰',       description: '俄罗斯文学家，《战争与和平》《安娜·卡列尼娜》作者', dynasty: '' },
  { name: '陀思妥耶夫斯基', description: '俄罗斯文学家，心理现实主义代表，《罪与罚》作者', dynasty: '' },
  { name: '狄更斯',         description: '英国作家，批判现实主义文学代表，《双城记》作者', dynasty: '' },
  { name: '雨果',           description: '法国文学家，浪漫主义领袖，《悲惨世界》作者', dynasty: '' },
  { name: '尼采',           description: '德国哲学家，"上帝已死"，超人哲学提出者', dynasty: '' },
  { name: '门捷列夫',       description: '俄罗斯化学家，元素周期表创立者', dynasty: '' },
  { name: '爱迪生',         description: '美国发明家，一生发明超过千项，"发明大王"', dynasty: '' },
  { name: '诺贝尔',         description: '瑞典化学家，炸药发明者，设立诺贝尔奖', dynasty: '' },
  { name: '马克·吐温',      description: '美国作家，《汤姆·索亚历险记》《哈克贝利·芬历险记》作者', dynasty: '' },
  { name: '巴尔扎克',       description: '法国作家，现实主义文学大师，《人间喜剧》作者', dynasty: '' },
  { name: '普希金',         description: '俄罗斯诗人，"俄罗斯文学的太阳"', dynasty: '' },
  { name: '肖邦',           description: '波兰钢琴家、作曲家，"钢琴诗人"', dynasty: '' },
  { name: '高尔基',         description: '俄罗斯作家，社会主义现实主义文学奠基人，《母亲》作者', dynasty: '' },
  { name: '契诃夫',         description: '俄罗斯作家，短篇小说艺术大师，现代戏剧先驱', dynasty: '' },
  { name: '易卜生',         description: '挪威剧作家，"现代戏剧之父"，社会问题剧开创者', dynasty: '' },

  // ── 国外 · 20世纪 ───────────────────────────────
  { name: '爱因斯坦',     description: '德裔美籍物理学家，相对论创立者，20世纪最伟大科学家', dynasty: '' },
  { name: '居里夫人',     description: '波兰裔法国物理学家、化学家，两次获得诺贝尔奖', dynasty: '' },
  { name: '弗洛伊德',     description: '奥地利心理学家，精神分析学创始人', dynasty: '' },
  { name: '甘地',         description: '印度民族解放运动领袖，以非暴力不合作著称', dynasty: '' },
  { name: '丘吉尔',       description: '英国首相，二战期间领导英国抵抗纳粹德国', dynasty: '' },
  { name: '罗斯福',       description: '美国第32任总统，新政实施者，领导美国参加二战', dynasty: '' },
  { name: '列宁',         description: '俄罗斯革命家，苏联创始人，马克思主义实践者', dynasty: '' },
  { name: '图灵',         description: '英国数学家，计算机科学与人工智能之父', dynasty: '' },
  { name: '弗莱明',       description: '苏格兰生物学家，青霉素的发现者', dynasty: '' },
  { name: '莱特兄弟',     description: '美国航空先驱，制造并驾驶世界上第一架动力飞机', dynasty: '' },
  { name: '福特',         description: '美国汽车工业之父，创立福特汽车，推广流水线生产', dynasty: '' },
  { name: '毕加索',       description: '西班牙画家，立体主义领袖，20世纪最具影响力的艺术家', dynasty: '' },
  { name: '海明威',       description: '美国作家，"迷惘的一代"代表，《老人与海》作者', dynasty: '' },
  { name: '卡夫卡',       description: '捷克德语小说家，荒诞文学代表，《变形记》作者', dynasty: '' },
  { name: '萨特',         description: '法国哲学家、作家，存在主义代表人物', dynasty: '' },
  { name: '曼德拉',       description: '南非政治家，反对种族隔离的斗士，南非首位黑人总统', dynasty: '' },
  { name: '马丁·路德·金', description: '美国民权运动领袖，"我有一个梦想"演讲者', dynasty: '' },
  { name: '特蕾莎修女',   description: '阿尔巴尼亚裔修女，毕生服务于印度贫民，诺贝尔和平奖得主', dynasty: '' },
  { name: '霍金',         description: '英国物理学家，黑洞理论研究者，《时间简史》作者', dynasty: '' },
  { name: '费曼',         description: '美国物理学家，量子电动力学奠基人，诺贝尔奖得主', dynasty: '' },
  { name: '玻尔',         description: '丹麦物理学家，量子力学奠基人，原子结构理论提出者', dynasty: '' },
  { name: '薛定谔',       description: '奥地利物理学家，量子力学创建者之一，薛定谔方程提出者', dynasty: '' },
  { name: '海德格尔',     description: '德国哲学家，存在主义代表，《存在与时间》作者', dynasty: '' },
  { name: '加缪',         description: '法国作家、哲学家，荒诞主义代表，《局外人》作者', dynasty: '' },
  { name: '乔伊斯',       description: '爱尔兰作家，意识流文学代表，《尤利西斯》作者', dynasty: '' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('已连接到 MongoDB');

    let inserted = 0, updated = 0, skipped = 0;

    for (const data of characters) {
      const existing = await Character.findOne({ name: data.name });
      if (existing) {
        // 已存在：仅补充 dynasty 字段，不覆盖已有 background 等数据
        if (!existing.dynasty && data.dynasty !== undefined) {
          await Character.updateOne({ name: data.name }, {
            $set: {
              dynasty: data.dynasty,
              gender: FEMALE_NAMES.has(data.name) ? 'female' : 'male'
            }
          });
          console.log(`更新朝代: ${data.name} → ${data.dynasty || '(国外)'}`);
          updated++;
        } else {
          // 已有 dynasty，补充 gender
          const correctGender = FEMALE_NAMES.has(data.name) ? 'female' : 'male';
          await Character.updateOne({ name: data.name }, { $set: { gender: correctGender } });
          skipped++;
        }
      } else {
        // 新建：background/knowledgeBoundary 用占位符，首次对话时由 AI 动态生成并覆盖
        await Character.create({
          name: data.name,
          description: data.description,
          dynasty: data.dynasty || '',
          gender: FEMALE_NAMES.has(data.name) ? 'female' : 'male',
          background: '-',
          works: [],
          knowledgeBoundary: '-',
        });
        console.log(`新增: ${data.name}`);
        inserted++;
      }
    }

    console.log(`\n✅ 完成！新增 ${inserted} 个，更新朝代 ${updated} 个，跳过 ${skipped} 个。`);
    console.log(`   共 200 个历史人物（国内100 + 国外100）。`);
  } catch (err) {
    console.error('初始化失败:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
