// Each course has ten questions: three introductory, three practice, four challenge.
// Choice answers are zero-based indexes. Pair questions map each left entry to its right entry.
const choice = (id, grade, subject, difficulty, prompt, options, answer, explanation) =>
  ({ id, grade, subject, difficulty, type: 'choice', prompt, options, answer, explanation });
const pair = (id, grade, subject, difficulty, prompt, pairs, explanation) =>
  ({ id, grade, subject, difficulty, type: 'pair', prompt, pairs, explanation });

export const SUBJECT_NAMES = Object.freeze({ english: '英语', math: '数学', chinese: '语文' });
export const DIFFICULTY_NAMES = Object.freeze({ easy: '入门', medium: '练习', hard: '挑战' });

export const BUILTIN_QUESTIONS = Object.freeze([
  // Grade 5 · English
  choice('e5-01', 5, 'english', 'easy', '“图书馆”的英文是？', ['library', 'hospital', 'kitchen', 'garden'], 0, 'library 表示图书馆。'),
  choice('e5-02', 5, 'english', 'easy', '选择正确句子：', ['She like apples.', 'She likes apples.', 'She liking apples.', 'She likes apple are.'], 1, '主语 she 是第三人称单数，一般现在时动词用 likes。'),
  choice('e5-03', 5, 'english', 'easy', '“I can swim.” 中 can 后面的动词形式是？', ['原形', '过去式', '现在分词', '第三人称单数'], 0, '情态动词 can 后接动词原形。'),
  choice('e5-04', 5, 'english', 'medium', '— What time is it? — It is 7:30. 这里 7:30 是？', ['seven fifteen', 'seven thirty', 'half to seven', 'thirty seven'], 1, '7:30 可以读作 seven thirty。'),
  choice('e5-05', 5, 'english', 'medium', '选择合适的介词：My birthday is ___ May.', ['at', 'on', 'in', 'to'], 2, '月份前通常使用介词 in。'),
  pair('e5-06', 5, 'english', 'medium', '将英文地点与中文意思配对。', [['hospital', '医院'], ['museum', '博物馆'], ['cinema', '电影院']], 'hospital、museum、cinema 分别表示医院、博物馆、电影院。'),
  choice('e5-07', 5, 'english', 'hard', '选择正确问句的回答：What does your father do?', ['He is kind.', 'He is a doctor.', 'He is at home.', 'He likes tea.'], 1, 'What does ... do? 用来询问职业。'),
  choice('e5-08', 5, 'english', 'hard', '选出比较级用法正确的句子。', ['This tree is tall than that one.', 'This tree is taller than that one.', 'This tree is tallest than that one.', 'This tree taller that one.'], 1, '两者比较用形容词比较级 taller，并接 than。'),
  choice('e5-09', 5, 'english', 'hard', '选择正确表达：桌上有三本书。', ['There is three books on the desk.', 'There are three books on the desk.', 'There are three book on the desk.', 'There be three books on the desk.'], 1, 'three books 是复数，there be 句型使用 there are。'),
  pair('e5-10', 5, 'english', 'hard', '将日常活动与对应的中文配对。', [['brush my teeth', '刷牙'], ['do my homework', '做家庭作业'], ['take a walk', '散步']], '注意词组要整体记忆。'),

  // Grade 5 · Math
  choice('m5-01', 5, 'math', 'easy', '0.6 + 0.25 = ?', ['0.31', '0.85', '0.75', '0.95'], 1, '小数点对齐：0.60 + 0.25 = 0.85。'),
  choice('m5-02', 5, 'math', 'easy', '24 的因数中，下面哪一个正确？', ['5', '7', '8', '10'], 2, '24 ÷ 8 = 3，所以 8 是 24 的因数。'),
  choice('m5-03', 5, 'math', 'easy', '一个长方形长 6 厘米、宽 4 厘米，面积是多少？', ['10 平方厘米', '20 平方厘米', '24 平方厘米', '26 平方厘米'], 2, '长方形面积 = 长 × 宽 = 6 × 4 = 24 平方厘米。'),
  choice('m5-04', 5, 'math', 'medium', '3.6 ÷ 0.6 = ?', ['0.6', '6', '60', '0.06'], 1, '把被除数和除数同时扩大 10 倍，变成 36 ÷ 6 = 6。'),
  choice('m5-05', 5, 'math', 'medium', '把 1/2 和 1/3 相加，结果是？', ['2/5', '1/6', '5/6', '3/6'], 2, '通分后 1/2 = 3/6，1/3 = 2/6，所以和为 5/6。'),
  pair('m5-06', 5, 'math', 'medium', '将图形与面积公式配对。', [['长方形', '长 × 宽'], ['平行四边形', '底 × 高'], ['三角形', '底 × 高 ÷ 2']], '三角形面积是同底同高平行四边形面积的一半。'),
  choice('m5-07', 5, 'math', 'hard', '解方程：3x + 5 = 20，x = ?', ['3', '5', '7', '15'], 1, '先减去 5 得 3x = 15，再除以 3 得 x = 5。'),
  choice('m5-08', 5, 'math', 'hard', '一块三角形地，底 12 米，高 5 米，面积是多少？', ['17 平方米', '30 平方米', '60 平方米', '120 平方米'], 1, '12 × 5 ÷ 2 = 30 平方米。'),
  choice('m5-09', 5, 'math', 'hard', '盒里有 3 个红球、2 个蓝球。任意摸一个，摸到蓝球的可能性是？', ['1/5', '2/5', '3/5', '2/3'], 1, '共有 5 个球，其中蓝球 2 个，可能性是 2/5。'),
  pair('m5-10', 5, 'math', 'hard', '将算式与结果配对。', [['2.5 × 4', '10'], ['7.2 ÷ 3', '2.4'], ['1/4 + 1/2', '3/4']], '分别计算小数乘除法，分数加法要先通分。'),

  // Grade 5 · Chinese
  choice('c5-01', 5, 'chinese', 'easy', '“聚精会神”最接近哪个意思？', ['非常专心', '非常生气', '很快离开', '互相帮助'], 0, '聚精会神形容注意力高度集中。'),
  choice('c5-02', 5, 'chinese', 'easy', '下列词语中，哪一组是反义词？', ['安静—宁静', '宽阔—狭窄', '快乐—高兴', '认真—仔细'], 1, '宽阔与狭窄的意思相反。'),
  choice('c5-03', 5, 'chinese', 'easy', '“一轮明月挂在天空。”这句话的数量词是？', ['明月', '天空', '一轮', '挂在'], 2, '“一轮”用来表示月亮的数量。'),
  choice('c5-04', 5, 'chinese', 'medium', '“小鸟在枝头唱歌。”主要使用了哪种修辞手法？', ['比喻', '拟人', '夸张', '排比'], 1, '把小鸟的叫声写成人的“唱歌”，是拟人。'),
  choice('c5-05', 5, 'chinese', 'medium', '下列句子中标点使用正确的是？', ['你吃饭了吗。', '多美的花啊！', '今天是星期几！', '我喜欢读书？'], 1, '感叹句“多美的花啊！”句末应使用感叹号。'),
  pair('c5-06', 5, 'chinese', 'medium', '将成语与意思配对。', [['画蛇添足', '多此一举'], ['守株待兔', '侥幸等待'], ['井底之蛙', '见识狭窄']], '理解成语所讲的故事，有助于记住它们的含义。'),
  choice('c5-07', 5, 'chinese', 'hard', '“不识庐山真面目，只缘身在此山中”说明了什么？', ['庐山很小', '要跳出局部看整体', '山中没有道路', '游山要带地图'], 1, '身处其中容易受到局部视角限制。'),
  choice('c5-08', 5, 'chinese', 'hard', '下列句子没有语病的是？', ['通过努力，使我进步了。', '我大约读了十本左右的书。', '我们要养成认真阅读的习惯。', '他首先第一个发言。'], 2, '其他句子分别存在缺少主语、语义重复、语义重复的问题。'),
  choice('c5-09', 5, 'chinese', 'hard', '“即使下雨，我们也按时出发。”表示哪种关系？', ['因果', '转折', '假设', '条件'], 2, '“即使……也……”表示让步假设关系。'),
  pair('c5-10', 5, 'chinese', 'hard', '将诗句与作者配对。', [['床前明月光', '李白'], ['春眠不觉晓', '孟浩然'], ['白日依山尽', '王之涣']], '三句分别出自《静夜思》《春晓》《登鹳雀楼》。'),

  // Grade 6 · English
  choice('e6-01', 6, 'english', 'easy', 'go 的过去式是？', ['goed', 'went', 'gone', 'going'], 1, 'go 的一般过去式是 went。'),
  choice('e6-02', 6, 'english', 'easy', '选择正确句子：', ['They was happy yesterday.', 'They were happy yesterday.', 'They are happy yesterday.', 'They be happy yesterday.'], 1, 'yesterday 表示过去；复数主语 they 搭配 were。'),
  choice('e6-03', 6, 'english', 'easy', '“Which season comes after spring?” 的答案是？', ['winter', 'autumn', 'summer', 'spring'], 2, '春天之后是夏天，英文为 summer。'),
  choice('e6-04', 6, 'english', 'medium', '选择正确表达：我昨天买了一本书。', ['I buy a book yesterday.', 'I bought a book yesterday.', 'I buying a book yesterday.', 'I buys a book yesterday.'], 1, 'yesterday 对应一般过去时；buy 的过去式是 bought。'),
  choice('e6-05', 6, 'english', 'medium', '“There ___ some milk in the glass.” 应填？', ['are', 'is', 'were', 'be'], 1, 'milk 是不可数名词，there be 句型用 is。'),
  pair('e6-06', 6, 'english', 'medium', '将动词原形与过去式配对。', [['eat', 'ate'], ['see', 'saw'], ['write', 'wrote']], '这些都是常见的不规则动词变化。'),
  choice('e6-07', 6, 'english', 'hard', '选择正确的将来时句子。', ['We will visit the museum tomorrow.', 'We visited the museum tomorrow.', 'We visits the museum tomorrow.', 'We visiting the museum tomorrow.'], 0, 'tomorrow 表示将来，可用 will + 动词原形。'),
  choice('e6-08', 6, 'english', 'hard', '“How did you go to school yesterday?” 的合适回答是？', ['I go by bus.', 'I went by bus.', 'I will go by bus.', 'I am going by bus.'], 1, '问句使用 did，回答过去的出行方式用 went。'),
  choice('e6-09', 6, 'english', 'hard', '选择正确句子：这本书比那本书更有趣。', ['This book is more interesting than that one.', 'This book is interesting than that one.', 'This book is most interesting than that one.', 'This book more interesting that one.'], 0, '多音节形容词 interesting 的比较级通常用 more interesting。'),
  pair('e6-10', 6, 'english', 'hard', '将问句与合适的回答配对。', [['Where did you go?', 'I went to the park.'], ['When did you leave?', 'At eight o’clock.'], ['Who went with you?', 'My sister.']], 'where 问地点，when 问时间，who 问人物。'),

  // Grade 6 · Math
  choice('m6-01', 6, 'math', 'easy', '3/4 化成百分数是？', ['25%', '50%', '75%', '80%'], 2, '3 ÷ 4 = 0.75 = 75%。'),
  choice('m6-02', 6, 'math', 'easy', '12 : 18 化成最简整数比是？', ['2 : 3', '3 : 2', '6 : 9', '4 : 6'], 0, '前后项同时除以最大公因数 6，得到 2 : 3。'),
  choice('m6-03', 6, 'math', 'easy', '一个圆的半径是 3 厘米，直径是？', ['1.5 厘米', '3 厘米', '6 厘米', '9 厘米'], 2, '直径是半径的 2 倍：3 × 2 = 6 厘米。'),
  choice('m6-04', 6, 'math', 'medium', '一件商品原价 80 元，打八折后的价格是？', ['8 元', '16 元', '64 元', '72 元'], 2, '八折是原价的 80%，80 × 0.8 = 64 元。'),
  choice('m6-05', 6, 'math', 'medium', '圆的半径是 2 厘米，面积是？（π 取 3.14）', ['6.28 平方厘米', '12.56 平方厘米', '25.12 平方厘米', '3.14 平方厘米'], 1, '圆面积 = πr² = 3.14 × 2² = 12.56 平方厘米。'),
  pair('m6-06', 6, 'math', 'medium', '将百分数与小数配对。', [['25%', '0.25'], ['60%', '0.6'], ['125%', '1.25']], '百分数除以 100 就是对应的小数。'),
  choice('m6-07', 6, 'math', 'hard', '一段路长 150 米，已走 40%，还剩多少米？', ['40 米', '60 米', '90 米', '110 米'], 2, '未走的部分是 60%，150 × 60% = 90 米。'),
  choice('m6-08', 6, 'math', 'hard', '地图比例尺为 1 : 100000，图上 3 厘米表示实际距离？', ['300 米', '3 千米', '30 千米', '300 千米'], 1, '实际 300000 厘米 = 3000 米 = 3 千米。'),
  choice('m6-09', 6, 'math', 'hard', '一个圆柱底面积 12 平方厘米，高 5 厘米，体积是？', ['17 立方厘米', '30 立方厘米', '60 立方厘米', '120 立方厘米'], 2, '圆柱体积 = 底面积 × 高 = 12 × 5 = 60 立方厘米。'),
  pair('m6-10', 6, 'math', 'hard', '将数量关系与结果配对。', [['20 的 30%', '6'], ['比 40 多 25%', '50'], ['60 减少 10%', '54']], '分别用乘法求百分数，再处理增加或减少的部分。'),

  // Grade 6 · Chinese
  choice('c6-01', 6, 'chinese', 'easy', '“千钧一发”形容什么？', ['十分危险紧急', '力量很大', '速度很快', '人数很多'], 0, '千钧一发比喻情况万分危急。'),
  choice('c6-02', 6, 'chinese', 'easy', '下列词语中，哪一组是近义词？', ['赞美—称赞', '巨大—微小', '诚实—虚伪', '勇敢—胆怯'], 0, '赞美与称赞意思相近。'),
  choice('c6-03', 6, 'chinese', 'easy', '“书籍是人类进步的阶梯。”使用了哪种修辞手法？', ['拟人', '比喻', '反问', '夸张'], 1, '把书籍比作阶梯，是比喻。'),
  choice('c6-04', 6, 'chinese', 'medium', '“他一边走，一边观察路边的植物。”中关联词表示？', ['同时进行', '条件关系', '因果关系', '递进关系'], 0, '“一边……一边……”表示两个动作同时进行。'),
  choice('c6-05', 6, 'chinese', 'medium', '“谁能说这不是一次成功的尝试呢？”改为陈述句，意思正确的是？', ['这不是一次成功的尝试。', '这可能不是一次成功的尝试。', '这是一次成功的尝试。', '谁也不知道是否成功。'], 2, '反问句表达肯定：这是一次成功的尝试。'),
  pair('c6-06', 6, 'chinese', 'medium', '将描写方法与例句配对。', [['动作描写', '他快步跑向教室。'], ['语言描写', '她说：“我来帮你。”'], ['心理描写', '他心想：一定要坚持。']], '抓住动作、说话内容和内心想法来判断。'),
  choice('c6-07', 6, 'chinese', 'hard', '下列句子没有语病的是？', ['大家都认真地听取了报告。', '通过这次活动，使我们懂得了合作。', '我买了文具、铅笔和书包等。', '这件事大约发生在两年前左右。'], 0, '其他句子分别存在缺少主语、分类重复、语义重复的问题。'),
  choice('c6-08', 6, 'chinese', 'hard', '“纸上得来终觉浅，绝知此事要躬行”强调什么？', ['只需多读书', '实践的重要性', '写字要用纸', '知识没有价值'], 1, '诗句强调亲身实践才能深入理解知识。'),
  choice('c6-09', 6, 'chinese', 'hard', '“虽然天气寒冷，但是大家依然坚持训练。”表示哪种关系？', ['因果', '转折', '并列', '选择'], 1, '“虽然……但是……”表示转折关系。'),
  pair('c6-10', 6, 'chinese', 'hard', '将古诗与作者配对。', [['《示儿》', '陆游'], ['《泊船瓜洲》', '王安石'], ['《己亥杂诗》', '龚自珍']], '三首诗的作者分别是陆游、王安石、龚自珍。'),
]);

export function courseKey(grade, subject) { return `${grade}-${subject}`; }

export function getCourseQuestions(questions, grade, subject) {
  return questions.filter(question => question.grade === Number(grade) && question.subject === subject)
    .sort((a, b) => ['easy', 'medium', 'hard'].indexOf(a.difficulty) - ['easy', 'medium', 'hard'].indexOf(b.difficulty));
}

export function validateQuestionBank(value) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 500) throw new Error('题库须为 3–500 道题的数组');
  const ids = new Set();
  return value.map((question, index) => {
    if (!question || typeof question !== 'object') throw new Error(`第 ${index + 1} 题格式错误`);
    const { id, grade, subject, difficulty, type, prompt, explanation } = question;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(id) || ids.has(id)) throw new Error(`第 ${index + 1} 题 ID 无效或重复`);
    ids.add(id);
    if (![5, 6].includes(grade) || !SUBJECT_NAMES[subject] || !DIFFICULTY_NAMES[difficulty]
      || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 300
      || typeof explanation !== 'string' || !explanation.trim() || explanation.length > 500) throw new Error(`第 ${index + 1} 题缺少年级、学科、难度、题干或解析`);
    if (type === 'choice') {
      if (!Array.isArray(question.options) || question.options.length !== 4
        || question.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 150)
        || new Set(question.options).size !== 4 || !Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) throw new Error(`第 ${index + 1} 道选择题选项或答案有误`);
    } else if (type === 'pair') {
      if (!Array.isArray(question.pairs) || question.pairs.length !== 3
        || question.pairs.some(entry => !Array.isArray(entry) || entry.length !== 2 || entry.some(text => typeof text !== 'string' || !text.trim() || text.length > 150))
        || new Set(question.pairs.map(entry => entry[0])).size !== 3
        || new Set(question.pairs.map(entry => entry[1])).size !== 3) throw new Error(`第 ${index + 1} 道配对题内容有误`);
    } else throw new Error(`第 ${index + 1} 题题型不支持`);
    return { ...question };
  });
}
