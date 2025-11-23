// 全局变量
let currentPage = 1;
const problemsPerPage = 10;
let allProblems = [];
let filteredProblems = [];
let allProblemStats = {};

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    loadProblems();
    
    // 添加事件监听
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('sortFilter').addEventListener('change', applyFilters);
    document.getElementById('langFilter').addEventListener('change', applyFilters);
    document.getElementById('difficultyFilter').addEventListener('change', applyFilters);
    document.getElementById('algorithmFilter').addEventListener('change', applyFilters);
    document.getElementById('dataStructureFilter').addEventListener('change', applyFilters);

    // 监听来自background.js的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log(`get message: ${request.action}`);
        if(request.action === "update-problem-stats") {
            loadProblemStats().then(() => {
                renderProblems(getCurrentPageProblems());
                renderPagination(filteredProblems.length);
            });
        }
    })
});

async function loadProblems() {
    // 从JSON文件加载数据
    const response = await fetch('all_problems.json');
    
    if (!response.ok) {
      throw new Error(`Fetch all problems error! status: ${response.status}`);
    }
    
    const data = await response.json();
    allProblems = data;
    filteredProblems = [...allProblems];

    await loadProblemStats();

    renderProblems(getCurrentPageProblems());
    renderPagination(filteredProblems.length);
}

function loadProblemStats() {
    return new Promise((resolve) => {
        chrome.storage.local.get((storageData) => {
            let problemStats = storageData.problemStats || {};
            allProblemStats = problemStats;
            resolve();
        });
    }) 
}

// 获取当前页的题目
function getCurrentPageProblems() {
    const startIndex = (currentPage - 1) * problemsPerPage;
    const endIndex = startIndex + problemsPerPage;
    return filteredProblems.slice(startIndex, endIndex);
}

// 渲染题目列表
function renderProblems(problemsToRender) {
    const problemListElement = document.getElementById('problemList');
    problemListElement.innerHTML = '';

    if (problemsToRender.length === 0) {
        // 显示空状态
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <h3>没有找到匹配的题目</h3>
            <p>尝试调整搜索条件或筛选器</p>
        `;
        problemListElement.appendChild(emptyState);
        return;
    }

    problemsToRender.forEach(problem => {
        const listItem = document.createElement('li');
        listItem.className = 'problem-item';
        
        const link = document.createElement('a');
        link.href = problem.link;
        link.className = 'problem-link';
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        
        // 根据难度设置样式类
        let difficultyClass = '';
        if (problem.difficulty === '简单') {
            difficultyClass = 'difficulty-easy';
        } else if (problem.difficulty === '中等') {
            difficultyClass = 'difficulty-medium';
        } else {
            difficultyClass = 'difficulty-hard';
        }
        
        link.innerHTML = `
            <div class="problem-title">${problem.id}: ${problem.title}</div>
            <div class="problem-meta">
                <span>${problem.attempts}</span>
                <span class="difficulty-tag ${difficultyClass}">${problem.difficulty}</span>
            </div>
        `;

        let statusClass = "";
        if(problem.id in allProblemStats) {
            if(allProblemStats[problem.id].accepted) {
                statusClass = "problem-accepted";
            } else {
                statusClass = "problem-attempted";
            }
        }
        if(statusClass) {
            listItem.classList.add(statusClass);
        }

        listItem.appendChild(link);
        problemListElement.appendChild(listItem);
    });
}



// 应用筛选条件
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const langauage = document.getElementById('langFilter').value;
    const difficulty = document.getElementById('difficultyFilter').value;
    const algorithm = document.getElementById('algorithmFilter').value;
    const dataStructure = document.getElementById('dataStructureFilter').value;

    filteredProblems = allProblems.filter(problem => {
        const matchesSearch = !searchTerm || problem.id.includes(searchTerm) ||
                             problem.title.toLowerCase().includes(searchTerm);
        
        const matchesLanguage = !langauage ||
                             (langauage === "chinese" && /[\u4e00-\u9fa5]/.test(problem.title)) ||
                             (langauage === "english" && !/[\u4e00-\u9fa5]/.test(problem.title));
        const matchesDifficulty = !difficulty || problem.difficulty === difficulty;
        const matchesAlgorithm = !algorithm || problem.algorithms.includes(algorithm);
        const matchesDataStructure = !dataStructure || problem.data_structures.includes(dataStructure);
        
        return matchesSearch && matchesLanguage && matchesDifficulty && matchesAlgorithm && matchesDataStructure;
    });

    const sortBy = document.getElementById('sortFilter').value;
    if(sortBy === "id") {
        filteredProblems.sort((p1, p2) => p1.id - p2.id);
    } else{
        filteredProblems.sort((p1, p2) => p2.attempts - p1.attempts);
    }

    currentPage = 1; // 重置到第一页
    renderProblems(getCurrentPageProblems());
    renderPagination(filteredProblems.length);
}

// 渲染分页控件
function renderPagination(totalProblems) {
    const paginationElement = document.getElementById('pagination');
    paginationElement.innerHTML = '';
    
    const totalPages = Math.ceil(totalProblems / problemsPerPage);
    
    // 上一页按钮
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.className = 'page-btn';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', goToPrevPage);
    paginationElement.appendChild(prevButton);
    
    // 页码信息
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    paginationElement.appendChild(pageInfo);
    
    // 下一页按钮
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.className = 'page-btn';
    nextButton.disabled = currentPage === totalPages || totalPages === 0;
    nextButton.addEventListener('click', goToNextPage);
    paginationElement.appendChild(nextButton);
    
    // 添加页码跳转功能（仅当有页面时才显示）
    if (totalPages > 0) {
        const jumpContainer = document.createElement('div');
        jumpContainer.className = 'page-jump-container';
        
        // 跳转输入框
        const jumpInput = document.createElement('input');
        jumpInput.type = 'number';
        jumpInput.className = 'page-jump-input';
        jumpInput.placeholder = '页码';
        jumpInput.min = 1;
        jumpInput.max = totalPages;
        jumpInput.value = currentPage;
        
        // 跳转按钮
        const jumpButton = document.createElement('button');
        jumpButton.textContent = '跳转';
        jumpButton.className = 'page-jump-btn';
        
        // 添加跳转事件
        jumpButton.addEventListener('click', function() {
            handlePageJump(jumpInput.value, totalPages);
        });
        
        // 添加回车键跳转支持
        jumpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handlePageJump(jumpInput.value, totalPages);
            }
        });
        
        jumpContainer.appendChild(jumpInput);
        jumpContainer.appendChild(jumpButton);
        paginationElement.appendChild(jumpContainer);
    }
}

// 处理页码跳转
function handlePageJump(targetPage, totalPages) {
    // 转换为整数
    const pageNum = parseInt(targetPage);
    
    // 验证输入
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
        alert(`请输入有效的页码 (1-${totalPages})`);
        return;
    }
    
    // 如果目标页码与当前页码相同，则不执行跳转
    if (pageNum === currentPage) {
        return;
    }
    
    // 跳转到指定页码
    currentPage = pageNum;
    renderProblems(getCurrentPageProblems());
    renderPagination(filteredProblems.length);
}

// 转到上一页
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderProblems(getCurrentPageProblems());
        renderPagination(filteredProblems.length);
    }
}

// 转到下一页
function goToNextPage() {
    const totalPages = Math.ceil(filteredProblems.length / problemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderProblems(getCurrentPageProblems());
        renderPagination(filteredProblems.length);
    }
}