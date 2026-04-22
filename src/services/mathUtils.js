/**
 * 计算累积消耗价值 (Cumulative Cost)
 * @param {string} model - 'linear' | 'exponential'
 * @param {object} params - 增长模型参数
 * @param {number} targetLevel - 目标等级
 * @returns {number} 累计消耗的总金本位价值
 */
export const calculateCumulativeCost = (model, params, targetLevel) => {
  if (targetLevel <= 0) return 0;
  
  let total = 0;
  if (model === 'linear') {
    // 假设 Cost(L) = slope * L
    // 累加：slope * (1 + 2 + ... + targetLevel) = slope * (1 + L) * L / 2
    const slope = params.slope || 10;
    total = slope * (1 + targetLevel) * targetLevel / 2;
  } else if (model === 'exponential') {
    // 假设 Cost(L) = baseCost * (baseMultiplier ^ L)
    // 这里我们简化：假设 baseCost = 10, multiplier = params.base
    const baseCost = params.baseCost || 10;
    const multiplier = params.base || 1.2;
    
    if (multiplier === 1) return baseCost * targetLevel;
    // 等比数列求和：a1 * (q^n - 1) / (q - 1)
    // 这里 a1 = baseCost * multiplier^1
    const a1 = baseCost * multiplier;
    total = a1 * (Math.pow(multiplier, targetLevel) - 1) / (multiplier - 1);
  }
  
  return total;
};
