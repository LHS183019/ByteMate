/**
 * 电子宠物渲染模块
 * 负责在 Dashboard 中渲染像素猫动画
 */

let petAnimationInterval = null;

/**
 * 渲染电子宠物
 * @param {Object} petData - 宠物数据
 */
function renderPet(petData) {
  const container = document.getElementById('pet-container');
  if (!container) return;

  // 清除旧内容
  container.innerHTML = '';
  
  // 创建图片元素
  const img = document.createElement('img');
  img.className = 'pet-image';
  img.alt = 'Pet';
  // 设置初始样式以避免闪烁
  img.style.imageRendering = 'pixelated'; // 保持像素风格
  img.style.width = '128px'; // 适当放大
  img.style.height = '128px';
  
  container.appendChild(img);

  // 动画配置
  const frameCount = 11; // 0-10
  const frameRate = 100; // ms per frame (10fps)
  let currentFrame = 0;
  const basePath = '../assets/kitten/idle_facing_left/pixil-frame-';

  // 清除旧的定时器
  if (petAnimationInterval) {
    clearInterval(petAnimationInterval);
  }

  // 预加载图片以避免闪烁
  const images = [];
  for (let i = 0; i < frameCount; i++) {
    const image = new Image();
    image.src = `${basePath}${i}.png`;
    images.push(image);
  }

  // 启动动画循环
  const updateFrame = () => {
    img.src = `${basePath}${currentFrame}.png`;
    currentFrame = (currentFrame + 1) % frameCount;
  };

  updateFrame(); // 立即显示第一帧
  petAnimationInterval = setInterval(updateFrame, frameRate);
  
  console.log(`🐱 宠物动画已启动: ${petData.name}`);
}

/**
 * 初始化宠物交互
 */
function initPetInteractions() {
  const feedBtn = document.getElementById('feed-pet-btn');
  const morePetsBtn = document.getElementById('more-pets-btn');
  const statusElement = document.getElementById('pet-status');

  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      // 简单的投喂反馈
      const originalText = statusElement.textContent;
      statusElement.textContent = '赵鱼鱼: 喵！好开心！🐟';
      statusElement.style.color = '#e11d48'; // 变红表示开心
      
      // 禁用按钮防止刷屏
      feedBtn.disabled = true;
      feedBtn.textContent = '已投喂';
      
      // 3秒后恢复
      setTimeout(() => {
        statusElement.textContent = originalText;
        statusElement.style.color = '';
        feedBtn.disabled = false;
        feedBtn.textContent = '🐟 投喂';
      }, 3000);
      
      // 这里可以添加发送遥测或更新心情存储的逻辑
      console.log('🐱 赵鱼鱼被投喂了');
    });
  }

  if (morePetsBtn) {
    morePetsBtn.addEventListener('click', () => {
      alert('更多小伙伴正在赶来的路上，敬请期待！🐱🐶🐰');
    });
  }
}

// 导出函数到全局作用域，以便 index.js 调用
window.renderPet = renderPet;
window.initPetInteractions = initPetInteractions;
