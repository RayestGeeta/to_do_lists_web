// 获取DOM元素
const todoInput = document.getElementById('todo-input');
const addButton = document.getElementById('add-button');
const todoList = document.getElementById('todo-list');
const itemsLeft = document.getElementById('items-left');
const filters = document.querySelectorAll('.filter');
const clearCompletedButton = document.getElementById('clear-completed');

// 待办事项数组
let todos = JSON.parse(localStorage.getItem('todos')) || [];
todos = todos.map(todo => ({
    ...todo,
    dueDate: todo.dueDate || '',
    priority: todo.priority || 'medium',
    tags: todo.tags || []
}));
saveTodos();
let searchTerm = '';
let language = 'zh';
const translations = {
    zh: {
        title: '待办事项清单',
        placeholder: '添加新的待办事项...',
        all: '全部',
        active: '未完成',
        completed: '已完成',
        clear: '清除已完成',
        itemsLeft: '项待办',
        footer: '双击待办事项可以编辑 | 拖动可以重新排序 | 支持日期、优先级、标签',
        syncToCloud: '同步到云端',
        loggedIn: '已登录',
        syncSuccess: '同步成功',
        syncFailed: '同步失败',
        loggedOut: '已退出登录',
        logoutFailed: '退出登录失败',
        loginToSync: '登录以同步',
        syncInProgress: '正在同步...',
        logout: '退出登录'
    },
    en: {
        title: 'To-Do List',
        placeholder: 'Add new todo...',
        all: 'All',
        active: 'Active',
        completed: 'Completed',
        clear: 'Clear completed',
        itemsLeft: 'items left',
        footer: 'Double-click to edit | Drag to reorder | Supports date, priority, tags',
        syncToCloud: 'Sync to Cloud',
        loggedIn: 'Logged In',
        syncSuccess: 'Sync successful',
        syncFailed: 'Sync failed',
        loggedOut: 'Logged out',
        logoutFailed: 'Logout failed',
        loginToSync: 'Login to sync',
        syncInProgress: 'Syncing...',
        logout: 'Logout'
    }
};

// 当前过滤状态
let currentFilter = 'all';

// 初始化应用
function init() {
    renderTodos();
    updateItemsCount();
    updateLanguage();
    
    addButton.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTodo(); });
    todoList.addEventListener('click', handleTodoClick);
    todoList.addEventListener('dblclick', handleTodoDblClick);
    filters.forEach(filter => { filter.addEventListener('click', () => setFilter(filter.dataset.filter)); });
    clearCompletedButton.addEventListener('click', clearCompleted);
    enableDragAndDrop();
    
    // New features
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderTodos();
    });
    
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        document.querySelector('.container').classList.toggle('dark');
    });
    
    const languageSelect = document.getElementById('language-select');
    languageSelect.addEventListener('change', (e) => {
        language = e.target.value;
        updateLanguage();
        renderTodos();
    });
    
    // 云同步功能
    const syncButton = document.getElementById('sync-button');
    syncButton.addEventListener('click', handleSyncButtonClick);
    
    // 检查是否已经登录
    checkAuthState();
    
    // 添加自动同步功能
    setupAutoSync();
}

// 处理同步按钮点击
function handleSyncButtonClick() {
    if (isLoggedIn) {
        // 如果已登录，显示下拉菜单
        const syncMenu = document.createElement('div');
        syncMenu.className = 'sync-menu';
        syncMenu.innerHTML = `
            <div class="sync-menu-item sync-now">${translations[language].syncToCloud}</div>
            <div class="sync-menu-item logout">${translations[language].logout}</div>
        `;
        
        // 定位菜单
        const syncButton = document.getElementById('sync-button');
        const rect = syncButton.getBoundingClientRect();
        syncMenu.style.top = `${rect.bottom}px`;
        syncMenu.style.left = `${rect.left}px`;
        
        document.body.appendChild(syncMenu);
        
        // 添加点击事件
        syncMenu.querySelector('.sync-now').addEventListener('click', () => {
            document.body.removeChild(syncMenu);
            syncToCloud();
        });
        
        syncMenu.querySelector('.logout').addEventListener('click', () => {
            document.body.removeChild(syncMenu);
            logoutFromCloud();
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', function closeMenu(e) {
            if (!syncMenu.contains(e.target) && e.target !== syncButton) {
                if (document.body.contains(syncMenu)) {
                    document.body.removeChild(syncMenu);
                }
                document.removeEventListener('click', closeMenu);
            }
        });
    } else {
        // 未登录，直接同步
        syncToCloud();
    }
}

// 检查认证状态
function checkAuthState() {
    auth.onAuthStateChanged(user => {
        if (user) {
            // 用户已登录
            currentUser = user;
            isLoggedIn = true;
            
            // 更新UI
            const syncButton = document.getElementById('sync-button');
            syncButton.textContent = translations[language].loggedIn;
            syncButton.classList.add('logged-in');
            
            // 设置实时同步
            setupRealtimeSync();
        }
    });
}

// 设置自动同步
function setupAutoSync() {
    // 监听本地数据变化，自动同步到云端
    const originalSaveTodos = saveTodos;
    saveTodos = function() {
        // 调用原始保存函数
        originalSaveTodos();
        
        // 如果已登录，自动同步到云端
        if (isLoggedIn && currentUser) {
            // 使用防抖，避免频繁同步
            clearTimeout(window.syncTimeout);
            window.syncTimeout = setTimeout(() => {
                const userDoc = doc(db, 'users', currentUser.uid);
                setDoc(userDoc, { todos }).catch(error => {
                    console.error('Auto sync error:', error);
                });
            }, 2000); // 2秒后同步
        }
    };
}

function updateLanguage() {
    const trans = translations[language];
    document.querySelector('h1').textContent = trans.title;
    todoInput.placeholder = trans.placeholder;
    filters[0].textContent = trans.all;
    filters[1].textContent = trans.active;
    filters[2].textContent = trans.completed;
    clearCompletedButton.textContent = trans.clear;
    itemsLeft.textContent = `0 ${trans.itemsLeft}`;
    document.querySelector('footer p').textContent = trans.footer;
}

// 全局变量，用于跟踪同步状态
let isLoggedIn = false;
let currentUser = null;
let unsubscribeSnapshot = null;

// 云同步功能
async function syncToCloud() {
    try {
        if (!isLoggedIn) {
            // 用户未登录，进行登录
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            currentUser = result.user;
            isLoggedIn = true;
            
            // 更新UI显示登录状态
            const syncButton = document.getElementById('sync-button');
            syncButton.textContent = translations[language].loggedIn;
            syncButton.classList.add('logged-in');
            
            // 首次同步数据到云端
            await syncData();
            
            // 设置实时监听
            setupRealtimeSync();
        } else {
            // 用户已登录，手动触发同步
            await syncData();
        }
    } catch (error) {
        console.error('Sync error:', error);
        alert(translations[language].syncFailed + ': ' + error.message);
    }
}

// 同步数据到云端
async function syncData() {
    try {
        if (!currentUser) return;
        
        // 显示同步中状态
        updateSyncStatus(translations[language].syncInProgress, 'syncing');
        
        const userDoc = doc(db, 'users', currentUser.uid);
        
        // 先获取云端数据
        const docSnap = await getDoc(userDoc);
        
        if (docSnap.exists()) {
            // 合并本地和云端数据
            const cloudTodos = docSnap.data().todos || [];
            mergeTodos(cloudTodos);
        } else {
            // 云端没有数据，直接上传本地数据
            await setDoc(userDoc, { todos });
        }
        
        // 显示同步成功消息
        showSyncNotification(translations[language].syncSuccess);
    } catch (error) {
        console.error('Data sync error:', error);
        showSyncNotification(translations[language].syncFailed + ': ' + error.message, true);
    }
}

// 设置实时同步
function setupRealtimeSync() {
    if (!currentUser) return;
    
    // 如果已有监听，先取消
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
    }
    
    const userDoc = doc(db, 'users', currentUser.uid);
    
    // 设置实时监听
    unsubscribeSnapshot = onSnapshot(userDoc, (doc) => {
        if (doc.exists()) {
            const cloudTodos = doc.data().todos || [];
            // 只有当云端数据与本地不同时才更新
            if (JSON.stringify(cloudTodos) !== JSON.stringify(todos)) {
                mergeTodos(cloudTodos, true);
            }
        }
    }, (error) => {
        console.error('Realtime sync error:', error);
    });
}

// 合并本地和云端数据
function mergeTodos(cloudTodos, isFromCloud = false) {
    // 创建ID到todo的映射
    const localTodosMap = {};
    todos.forEach(todo => {
        localTodosMap[todo.id] = todo;
    });
    
    const cloudTodosMap = {};
    cloudTodos.forEach(todo => {
        cloudTodosMap[todo.id] = todo;
    });
    
    // 合并策略：保留两边的所有项目，如有冲突则根据来源决定
    const mergedTodos = [];
    
    // 处理所有ID
    const allIds = new Set([...Object.keys(localTodosMap), ...Object.keys(cloudTodosMap)]);
    
    allIds.forEach(id => {
        const localTodo = localTodosMap[id];
        const cloudTodo = cloudTodosMap[id];
        
        if (localTodo && cloudTodo) {
            // 两边都有，根据来源决定保留哪个
            mergedTodos.push(isFromCloud ? cloudTodo : localTodo);
        } else if (localTodo) {
            // 只有本地有
            mergedTodos.push(localTodo);
        } else if (cloudTodo) {
            // 只有云端有
            mergedTodos.push(cloudTodo);
        }
    });
    
    // 更新本地数据
    todos = mergedTodos;
    saveTodos();
    renderTodos();
    updateItemsCount();
    
    // 如果是本地更新触发的合并，则更新云端数据
    if (!isFromCloud && currentUser) {
        const userDoc = doc(db, 'users', currentUser.uid);
        setDoc(userDoc, { todos }).catch(error => {
            console.error('Error updating cloud data:', error);
        });
    }
}

// 显示同步通知
function showSyncNotification(message, isError = false) {
    // 更新同步状态指示器
    updateSyncStatus(message, isError ? 'error' : 'success');
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `sync-notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 2秒后自动消失
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 500);
    }, 2000);
}

// 更新同步状态指示器
function updateSyncStatus(message, status = '') {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) {
        syncStatus.textContent = message;
        syncStatus.className = '';
        if (status) {
            syncStatus.classList.add(status);
        }
        
        // 3秒后清除状态
        clearTimeout(window.statusTimeout);
        window.statusTimeout = setTimeout(() => {
            syncStatus.textContent = '';
            syncStatus.className = '';
        }, 3000);
    }
}

// 登出功能
async function logoutFromCloud() {
    try {
        if (isLoggedIn && auth) {
            await auth.signOut();
            isLoggedIn = false;
            currentUser = null;
            
            // 取消实时监听
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            
            // 更新UI
            const syncButton = document.getElementById('sync-button');
            syncButton.textContent = translations[language].syncToCloud;
            syncButton.classList.remove('logged-in');
            
            showSyncNotification(translations[language].loggedOut);
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert(translations[language].logoutFailed + ': ' + error.message);
    }
}

// 渲染待办事项列表
function renderTodos() {
    todoList.innerHTML = '';
    
    const filteredTodos = filterTodos();
    
    filteredTodos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;
        li.draggable = true;
        
        li.innerHTML = `
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
            <div class="todo-content">
                <input type="text" class="todo-text" value="${todo.text}" readonly>
                <input type="datetime-local" class="todo-due" value="${todo.dueDate}" style="display:none;">
                <select class="todo-priority" style="display:none;">
                    <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
                <input type="text" class="todo-tags" value="${todo.tags.join(', ')}" placeholder="Tags" style="display:none;">
                <span class="todo-display-due">${todo.dueDate ? new Date(todo.dueDate).toLocaleString() : ''}</span>
                <span class="todo-display-priority ${todo.priority}">${todo.priority}</span>
                <span class="todo-display-tags">${todo.tags.join(', ')}</span>
            </div>
            <div class="todo-actions">
                <button class="todo-edit"><i class="fas fa-edit"></i></button>
                <button class="todo-delete"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        
        todoList.appendChild(li);
    });
}

// 过滤待办事项
function filterTodos() {
    let filtered = todos;
    switch(currentFilter) {
        case 'active':
            filtered = filtered.filter(todo => !todo.completed);
            break;
        case 'completed':
            filtered = filtered.filter(todo => todo.completed);
            break;
    }
    if (searchTerm) {
        filtered = filtered.filter(todo => 
            todo.text.toLowerCase().includes(searchTerm) ||
            todo.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    }
    return filtered;
}

// 设置过滤器
function setFilter(filter) {
    currentFilter = filter;
    
    // 更新过滤器UI
    filters.forEach(f => {
        if (f.dataset.filter === filter) {
            f.classList.add('active');
        } else {
            f.classList.remove('active');
        }
    });
    
    renderTodos();
}

// 添加新待办事项
function addTodo() {
    const text = todoInput.value.trim();
    
    if (text) {
        const newTodo = {
            id: Date.now().toString(),
            text: text,
            completed: false,
            dueDate: '',
            priority: 'medium',
            tags: []
        };
        
        todos.push(newTodo);
        saveTodos();
        renderTodos();
        updateItemsCount();
        
        // 清空输入框
        todoInput.value = '';
        todoInput.focus();
    }
}

// 处理待办事项点击事件
function handleTodoClick(e) {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    
    const id = item.dataset.id;
    const todo = todos.find(t => t.id === id);
    
    // 复选框点击
    if (e.target.classList.contains('todo-checkbox')) {
        todo.completed = e.target.checked;
        item.classList.toggle('completed', todo.completed);
        saveTodos();
        updateItemsCount();
    }
    
    // 编辑按钮点击
    if (e.target.classList.contains('todo-edit') || e.target.closest('.todo-edit')) {
        startEditing(item);
    }
    
    // 删除按钮点击
    if (e.target.classList.contains('todo-delete') || e.target.closest('.todo-delete')) {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
        updateItemsCount();
    }
}

// 处理待办事项双击事件（编辑）
function handleTodoDblClick(e) {
    const item = e.target.closest('.todo-item');
    if (!item || !e.target.classList.contains('todo-text')) return;
    
    startEditing(item);
}

// 开始编辑待办事项
function startEditing(item) {
    const textInput = item.querySelector('.todo-text');
    const dueInput = item.querySelector('.todo-due');
    const prioritySelect = item.querySelector('.todo-priority');
    const tagsInput = item.querySelector('.todo-tags');
    const actionsDiv = item.querySelector('.todo-actions');
    
    // 保存原始操作按钮的HTML
    const originalActions = actionsDiv.innerHTML;
    
    // 添加保存按钮
    actionsDiv.innerHTML = `
        <button class="todo-save"><i class="fas fa-save"></i> 保存</button>
        <button class="todo-cancel"><i class="fas fa-times"></i> 取消</button>
    `;
    
    // 添加保存和取消按钮的事件监听器
    const saveButton = actionsDiv.querySelector('.todo-save');
    const cancelButton = actionsDiv.querySelector('.todo-cancel');
    
    saveButton.addEventListener('click', () => {
        finishEditing(item);
        // 恢复原始操作按钮
        actionsDiv.innerHTML = originalActions;
    });
    
    cancelButton.addEventListener('click', () => {
        // 取消编辑，恢复原始状态
        item.classList.remove('editing');
        textInput.readOnly = true;
        dueInput.style.display = 'none';
        prioritySelect.style.display = 'none';
        tagsInput.style.display = 'none';
        // 恢复原始操作按钮
        actionsDiv.innerHTML = originalActions;
        // 重新渲染以恢复原始数据
        renderTodos();
    });
    
    item.classList.add('editing');
    textInput.readOnly = false;
    dueInput.style.display = 'inline';
    prioritySelect.style.display = 'inline';
    tagsInput.style.display = 'inline';
    textInput.focus();
    const length = textInput.value.length;
    textInput.setSelectionRange(length, length);
    
    // 移除blur事件监听器，改为使用保存按钮
    textInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveButton.click(); });
}
function finishEditing(item) {
    const textInput = item.querySelector('.todo-text');
    const dueInput = item.querySelector('.todo-due');
    const prioritySelect = item.querySelector('.todo-priority');
    const tagsInput = item.querySelector('.todo-tags');
    const displayDue = item.querySelector('.todo-display-due');
    const displayPriority = item.querySelector('.todo-display-priority');
    const displayTags = item.querySelector('.todo-display-tags');
    
    item.classList.remove('editing');
    textInput.readOnly = true;
    dueInput.style.display = 'none';
    prioritySelect.style.display = 'none';
    tagsInput.style.display = 'none';
    
    const id = item.dataset.id;
    const todo = todos.find(t => t.id === id);
    const newText = textInput.value.trim();
    
    if (newText) {
        // 保存编辑的内容
        todo.text = newText;
        todo.dueDate = dueInput.value;
        todo.priority = prioritySelect.value;
        todo.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        // 更新显示
        displayDue.textContent = todo.dueDate ? new Date(todo.dueDate).toLocaleString() : '';
        displayPriority.textContent = todo.priority;
        displayPriority.className = `todo-display-priority ${todo.priority}`;
        displayTags.textContent = todo.tags.join(', ');
        
        saveTodos();
    } else {
        // 如果文本为空，删除该待办事项
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
        updateItemsCount();
    }
}

// 注意：此处不需要重复定义finishEditing函数，上面已经定义过了

// 清除已完成的待办事项
function clearCompleted() {
    todos = todos.filter(todo => !todo.completed);
    saveTodos();
    renderTodos();
    updateItemsCount();
}

// 更新剩余待办事项计数
function updateItemsCount() {
    const activeCount = todos.filter(todo => !todo.completed).length;
    const trans = translations[language];
    itemsLeft.textContent = `${activeCount} ${trans.itemsLeft}`;
}

// 保存待办事项到本地存储
function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// 启用拖拽功能
function enableDragAndDrop() {
    todoList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('todo-item')) {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
        }
    });
    
    todoList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('todo-item')) {
            e.target.classList.remove('dragging');
        }
    });
    
    todoList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = document.querySelector('.dragging');
        if (!draggingItem) return;
        
        const siblings = [...todoList.querySelectorAll('.todo-item:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            return e.clientY < sibling.getBoundingClientRect().top + sibling.offsetHeight / 2;
        });
        
        todoList.insertBefore(draggingItem, nextSibling);
    });
    
    todoList.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const draggingItem = document.querySelector(`[data-id="${id}"]`);
        if (!draggingItem) return;
        
        // 更新数组顺序
        const newTodos = [];
        document.querySelectorAll('.todo-item').forEach(item => {
            const todo = todos.find(t => t.id === item.dataset.id);
            if (todo) newTodos.push(todo);
        });
        
        todos = newTodos;
        saveTodos();
    });
}

// 初始化应用
document.addEventListener('DOMContentLoaded', init);