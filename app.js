// 获取DOM元素
const todoInput = document.getElementById('todo-input');
const addButton = document.getElementById('add-button');
const todoList = document.getElementById('todo-list');
const itemsLeft = document.getElementById('items-left');
const filters = document.querySelectorAll('.filter');
const clearCompletedButton = document.getElementById('clear-completed');

// 待办事项数组
let todos = JSON.parse(localStorage.getItem('todos')) || [];

// 当前过滤状态
let currentFilter = 'all';

// 初始化应用
function init() {
    renderTodos();
    updateItemsCount();
    
    // 添加事件监听器
    addButton.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    todoList.addEventListener('click', handleTodoClick);
    todoList.addEventListener('dblclick', handleTodoDblClick);
    
    // 过滤器事件
    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            setFilter(filter.dataset.filter);
        });
    });
    
    // 清除已完成事项
    clearCompletedButton.addEventListener('click', clearCompleted);
    
    // 启用拖拽功能
    enableDragAndDrop();
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
            <input type="text" class="todo-text" value="${todo.text}" readonly>
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
    switch(currentFilter) {
        case 'active':
            return todos.filter(todo => !todo.completed);
        case 'completed':
            return todos.filter(todo => todo.completed);
        default:
            return todos;
    }
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
            completed: false
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
    item.classList.add('editing');
    textInput.readOnly = false;
    textInput.focus();
    
    // 将光标移到文本末尾
    const length = textInput.value.length;
    textInput.setSelectionRange(length, length);
    
    // 添加失去焦点和按键事件
    textInput.addEventListener('blur', () => finishEditing(item), { once: true });
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            textInput.blur();
        }
    });
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            textInput.value = todos.find(t => t.id === item.dataset.id).text;
            textInput.blur();
        }
    });
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
    itemsLeft.textContent = `${activeCount} 项待办`;
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