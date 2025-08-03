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
        footer: '双击待办事项可以编辑 | 拖动可以重新排序 | 支持日期、优先级、标签'
    },
    en: {
        title: 'To-Do List',
        placeholder: 'Add new todo...',
        all: 'All',
        active: 'Active',
        completed: 'Completed',
        clear: 'Clear completed',
        itemsLeft: 'items left',
        footer: 'Double-click to edit | Drag to reorder | Supports date, priority, tags'
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
    
    const syncButton = document.getElementById('sync-button');
    syncButton.addEventListener('click', syncToCloud);
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

async function syncToCloud() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userDoc = doc(db, 'users', user.uid);
        await setDoc(userDoc, { todos });
        alert('Synced successfully!');
        // Listen for changes
        onSnapshot(userDoc, (doc) => {
            if (doc.exists()) {
                todos = doc.data().todos || [];
                saveTodos();
                renderTodos();
                updateItemsCount();
            }
        });
    } catch (error) {
        console.error('Sync error:', error);
        alert('Sync failed: ' + error.message);
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
    item.classList.add('editing');
    textInput.readOnly = false;
    dueInput.style.display = 'inline';
    prioritySelect.style.display = 'inline';
    tagsInput.style.display = 'inline';
    textInput.focus();
    const length = textInput.value.length;
    textInput.setSelectionRange(length, length);
    const finishEdit = () => finishEditing(item);
    textInput.addEventListener('blur', finishEdit, { once: true });
    dueInput.addEventListener('blur', finishEdit, { once: true });
    prioritySelect.addEventListener('blur', finishEdit, { once: true });
    tagsInput.addEventListener('blur', finishEdit, { once: true });
    textInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') textInput.blur(); });
    // Similar for others if needed
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
        todo.text = newText;
        todo.dueDate = dueInput.value;
        todo.priority = prioritySelect.value;
        todo.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
        displayDue.textContent = todo.dueDate ? new Date(todo.dueDate).toLocaleString() : '';
        displayPriority.textContent = todo.priority;
        displayPriority.className = `todo-display-priority ${todo.priority}`;
        displayTags.textContent = todo.tags.join(', ');
        saveTodos();
    } else {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
        updateItemsCount();
    }
}

// 完成编辑待办事项
function finishEditing(item) {
    const textInput = item.querySelector('.todo-text');
    const id = item.dataset.id;
    const todo = todos.find(t => t.id === id);
    
    item.classList.remove('editing');
    textInput.readOnly = true;
    
    const newText = textInput.value.trim();
    if (newText) {
        todo.text = newText;
        saveTodos();
    } else {
        // 如果文本为空，删除该待办事项
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
        updateItemsCount();
    }
}

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