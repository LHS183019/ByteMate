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
  
  console.log(`🐱 宠物动画已启动: ${petData.name} (Lv.${petData.level})`);
}

// 导出函数到全局作用域，以便 index.js 调用
window.renderPet = renderPet;
