import React from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { 
  Zap, 
  Settings, 
  ShieldCheck, 
  ArrowRightLeft, 
  Database,
  TrendingUp,
  Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const Dashboard = () => {
  const { state } = useGame();

  // 准备宏观分配数据用于图表
  const chartData = state.macros[0]?.allocations ? 
    Object.entries(state.macros[0].allocations).map(([id, value]) => ({
      name: state.features.find(f => f.id === id)?.name || id,
      value
    })) : [];

  const COLORS = ['#7C4DFF', '#00E5FF', '#00E676', '#FFAB40', '#FF5252'];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      className="dashboard-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ padding: '2rem' }}
    >
      {/* 顶部动态标题区 */}
      <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 className="glow-text" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
          数值控制塔
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
          实时监控与动态调节游戏经济生态系统
        </p>
      </motion.div>

      {/* 核心功能可视化网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* 金本位数据填充模块 */}
        <motion.div variants={itemVariants} className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(124, 77, 255, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <Zap color="#7C4DFF" size={24} />
            </div>
            <h3>金本位锚点</h3>
          </div>
          
          <div style={{ position: 'relative', height: '100px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-end', padding: '4px' }}>
             <motion.div 
               initial={{ height: 0 }}
               animate={{ height: '70%' }}
               transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}
               style={{ width: '100%', background: 'linear-gradient(to top, #7C4DFF, #B388FF)', borderRadius: '8px', opacity: 0.6 }}
             />
             <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
               <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{state.baseSettings.diamondPerTime} 💎</div>
               <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>每{state.baseSettings.timeUnit}价值</div>
             </div>
          </div>
          
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>系统通胀率</span>
            <span style={{ color: '#00E676' }}>正常 (0.2%)</span>
          </div>
        </motion.div>

        {/* 宏观配置动态分配模块 */}
        <motion.div variants={itemVariants} className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(0, 229, 255, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <Settings color="#00E5FF" size={24} />
            </div>
            <h3>宏观资源分配</h3>
          </div>
          
          <div style={{ height: '150px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div style={{ marginTop: '1rem', fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
             {chartData.map((d, i) => (
               <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                 <span>{d.name}: {d.value}%</span>
               </div>
             ))}
          </div>
        </motion.div>

        {/* 自动化验证状态模块 */}
        <motion.div variants={itemVariants} className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(0, 230, 118, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <ShieldCheck color="#00E676" size={24} />
            </div>
            <h3>经济模型验证</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid #00E676', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span>生产/消耗平衡</span>
               <motion.div 
                 animate={{ scale: [1, 1.2, 1] }}
                 transition={{ duration: 2, repeat: Infinity }}
                 style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00E676' }}
               />
            </div>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid #00E676', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span>成长曲线平滑度</span>
               <Activity size={16} color="#00E676" />
            </div>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid #FFAB40', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span>金币汇率风险</span>
               <span style={{ fontSize: '0.8rem', color: '#FFAB40' }}>检测到波动</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 数据流向装饰图 */}
      <motion.div 
        variants={itemVariants}
        style={{ marginTop: '4rem', padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <Database size={32} color="var(--text-secondary)" />
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>底层字典</div>
          </div>
          <motion.div 
            animate={{ x: [0, 20, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowRightLeft size={24} color="var(--text-muted)" />
          </motion.div>
          <div style={{ textAlign: 'center' }}>
            <TrendingUp size={32} color="var(--accent-secondary)" />
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>宏观规划</div>
          </div>
          <motion.div 
            animate={{ x: [0, 20, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          >
            <ArrowRightLeft size={24} color="var(--text-muted)" />
          </motion.div>
          <div style={{ textAlign: 'center' }}>
            <Zap size={32} color="var(--accent-primary)" />
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>数值落地</div>
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
};

export default Dashboard;
