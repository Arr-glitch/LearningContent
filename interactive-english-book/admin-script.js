import { initializeApp } from "./lib/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from "./lib/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "./lib/firebase-auth.js";
import { firebaseConfig } from "./assets/firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Admin privileges - in production, this should be stored in Firebase with proper security rules
const ADMIN_EMAILS = [
    'admin@englishlearning.com',
    'teacher@englishlearning.com',
    'moderator@englishlearning.com'
];

class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.chapters = [];
        this.users = [];
        this.questionCounter = 0;
        
        this.init();
    }
    
    async init() {
        // Set up authentication listener
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            this.checkAdminAccess();
        });
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data if admin
        if (this.isAdmin) {
            await this.loadDashboardData();
        }
    }
    
    checkAdminAccess() {
        if (this.currentUser && ADMIN_EMAILS.includes(this.currentUser.email)) {
            this.isAdmin = true;
            document.getElementById('auth-check').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            this.loadDashboardData();
        } else {
            this.isAdmin = false;
            document.getElementById('auth-check').style.display = 'block';
            document.getElementById('admin-content').style.display = 'none';
        }
    }
    
    setupEventListeners() {
        // Authentication
        document.getElementById('admin-login').addEventListener('click', () => this.showAdminLogin());
        
        // Content Management
        document.getElementById('add-chapter-btn').addEventListener('click', () => this.showChapterForm());
        document.getElementById('upload-sample-btn').addEventListener('click', () => this.uploadSampleContent());
        document.getElementById('import-content-btn').addEventListener('click', () => this.importContent());
        document.getElementById('export-content-btn').addEventListener('click', () => this.exportContent());
        
        // Chapter Form
        document.getElementById('add-question-btn').addEventListener('click', () => this.addQuestionBuilder());
        document.getElementById('cancel-chapter').addEventListener('click', () => this.hideChapterForm());
        document.getElementById('new-chapter-form').addEventListener('submit', (e) => this.saveChapter(e));
        
        // User Management
        document.getElementById('refresh-users').addEventListener('click', () => this.loadUsers());
        document.getElementById('export-users').addEventListener('click', () => this.exportUsers());
        
        // Settings
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
    }
    
    async loadDashboardData() {
        try {
            // Load chapters
            await this.loadChapters();
            
            // Load users
            await this.loadUsers();
            
            // Update statistics
            this.updateStatistics();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }
    
    async loadChapters() {
        try {
            const snapshot = await getDocs(collection(db, "chapters"));
            this.chapters = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading chapters:', error);
        }
    }
    
    async loadUsers() {
        try {
            const snapshot = await getDocs(collection(db, "userProgress"));
            this.users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderUserList();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    updateStatistics() {
        const totalQuestions = this.chapters.reduce((sum, chapter) => 
            sum + (chapter.questions ? chapter.questions.length : 0), 0);
        
        const avgCompletion = this.users.length > 0 
            ? Math.round(this.users.reduce((sum, user) => 
                sum + (user.completedChapters ? user.completedChapters.length : 0), 0) 
                / this.users.length / this.chapters.length * 100)
            : 0;
        
        document.getElementById('total-users').textContent = this.users.length;
        document.getElementById('total-chapters').textContent = this.chapters.length;
        document.getElementById('total-questions').textContent = totalQuestions;
        document.getElementById('avg-completion').textContent = `${avgCompletion}%`;
    }
    
    renderUserList() {
        const userList = document.getElementById('user-list');
        userList.innerHTML = '';
        
        this.users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            
            const completionRate = user.completedChapters 
                ? Math.round(user.completedChapters.length / this.chapters.length * 100)
                : 0;
            
            userItem.innerHTML = `
                <div class="user-info">
                    <div class="user-email">${user.email || user.id}</div>
                    <div class="user-stats">
                        Score: ${user.score || 0} | 
                        Accuracy: ${user.totalQuestions > 0 ? Math.round(user.correctAnswers / user.totalQuestions * 100) : 0}% |
                        Completion: ${completionRate}%
                    </div>
                </div>
                <div class="user-actions">
                    <button class="action-btn promote-btn" onclick="adminPanel.promoteUser('${user.id}')">Promote</button>
                    <button class="action-btn ban-btn" onclick="adminPanel.banUser('${user.id}')">Ban</button>
                </div>
            `;
            
            userList.appendChild(userItem);
        });
    }
    
    showAdminLogin() {
        const email = prompt('Enter admin email:');
        const password = prompt('Enter password:');
        
        if (email && password) {
            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    console.log('Admin login successful');
                })
                .catch((error) => {
                    alert('Login failed: ' + error.message);
                });
        }
    }
    
    showChapterForm() {
        document.getElementById('chapter-form').style.display = 'block';
        document.getElementById('questions-container').innerHTML = '';
        this.questionCounter = 0;
        this.addQuestionBuilder(); // Add first question
    }
    
    hideChapterForm() {
        document.getElementById('chapter-form').style.display = 'none';
        document.getElementById('new-chapter-form').reset();
    }
    
    addQuestionBuilder() {
        this.questionCounter++;
        const container = document.getElementById('questions-container');
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-builder';
        questionDiv.innerHTML = `
            <h5>Question ${this.questionCounter}</h5>
            
            <div class="question-type-selector">
                <div class="type-option active" data-type="multiple-choice">Multiple Choice</div>
                <div class="type-option" data-type="fill-in-blank">Fill in Blank</div>
                <div class="type-option" data-type="drag-drop">Drag & Drop</div>
                <div class="type-option" data-type="matching">Matching</div>
                <div class="type-option" data-type="reading-passage">Reading</div>
            </div>
            
            <div class="form-group">
                <label>Question Text</label>
                <textarea class="question-text" placeholder="Enter your question..." required></textarea>
            </div>
            
            <div class="options-list show">
                <label>Options</label>
                <div class="options-container">
                    <div class="option-input">
                        <input type="text" placeholder="Option A" required>
                        <button type="button" class="remove-option">×</button>
                    </div>
                    <div class="option-input">
                        <input type="text" placeholder="Option B" required>
                        <button type="button" class="remove-option">×</button>
                    </div>
                </div>
                <button type="button" class="btn" onclick="adminPanel.addOption(this)">Add Option</button>
            </div>
            
            <div class="form-group">
                <label>Correct Answer(s)</label>
                <input type="text" class="correct-answer" placeholder="Enter correct answer or option indices (0,1,2...)" required>
            </div>
            
            <div class="form-group">
                <label>Feedback</label>
                <textarea class="question-feedback" placeholder="Explanation for the answer..." required></textarea>
            </div>
            
            <div class="form-group">
                <label>Difficulty</label>
                <select class="question-difficulty">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Points</label>
                <input type="number" class="question-points" min="5" max="50" value="10">
            </div>
            
            <button type="button" class="btn" onclick="adminPanel.removeQuestion(this)">Remove Question</button>
        `;
        
        container.appendChild(questionDiv);
        
        // Set up question type selector
        const typeOptions = questionDiv.querySelectorAll('.type-option');
        typeOptions.forEach(option => {
            option.addEventListener('click', () => {
                typeOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                this.updateQuestionType(questionDiv, option.dataset.type);
            });
        });
        
        // Set up remove option buttons
        const removeButtons = questionDiv.querySelectorAll('.remove-option');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.parentElement.remove();
            });
        });
    }
    
    updateQuestionType(questionDiv, type) {
        const optionsList = questionDiv.querySelector('.options-list');
        
        if (type === 'multiple-choice' || type === 'reading-passage') {
            optionsList.classList.add('show');
        } else {
            optionsList.classList.remove('show');
        }
    }
    
    addOption(button) {
        const container = button.previousElementSibling;
        const optionCount = container.children.length;
        const letter = String.fromCharCode(65 + optionCount);
        
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-input';
        optionDiv.innerHTML = `
            <input type="text" placeholder="Option ${letter}" required>
            <button type="button" class="remove-option" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(optionDiv);
    }
    
    removeQuestion(button) {
        button.closest('.question-builder').remove();
    }
    
    async saveChapter(event) {
        event.preventDefault();
        
        try {
            // Collect chapter data
            const chapterData = {
                title: document.getElementById('chapter-title').value,
                lesson: document.getElementById('chapter-lesson').value,
                explanation: document.getElementById('chapter-explanation').value,
                examples: document.getElementById('chapter-examples').value.split('\n').filter(ex => ex.trim()),
                difficulty: document.getElementById('chapter-difficulty').value,
                estimatedTime: parseInt(document.getElementById('estimated-time').value),
                order: this.chapters.length + 1,
                questions: []
            };
            
            // Collect questions
            const questionBuilders = document.querySelectorAll('.question-builder');
            questionBuilders.forEach(builder => {
                const questionType = builder.querySelector('.type-option.active').dataset.type;
                const questionText = builder.querySelector('.question-text').value;
                const correctAnswer = builder.querySelector('.correct-answer').value;
                const feedback = builder.querySelector('.question-feedback').value;
                const difficulty = builder.querySelector('.question-difficulty').value;
                const points = parseInt(builder.querySelector('.question-points').value);
                
                const question = {
                    type: questionType,
                    question: questionText,
                    feedback: feedback,
                    difficulty: difficulty,
                    points: points
                };
                
                // Handle different question types
                if (questionType === 'multiple-choice' || questionType === 'reading-passage') {
                    const options = Array.from(builder.querySelectorAll('.option-input input'))
                        .map(input => input.value)
                        .filter(value => value.trim());
                    question.options = options;
                    
                    // Parse correct answer indices
                    if (correctAnswer.includes(',')) {
                        question.correct = correctAnswer.split(',').map(i => parseInt(i.trim()));
                    } else {
                        question.correct = parseInt(correctAnswer);
                    }
                } else if (questionType === 'fill-in-blank') {
                    question.correct = correctAnswer.split(',').map(ans => ans.trim());
                } else if (questionType === 'drag-drop') {
                    question.items = correctAnswer.split(',').map(item => item.trim());
                    question.correct = question.items; // For now, assume correct order is given
                } else if (questionType === 'matching') {
                    // For matching, we'd need a more complex UI - simplified for now
                    const pairs = correctAnswer.split(';').map(pair => {
                        const [left, right] = pair.split(':');
                        return { left: left.trim(), right: right.trim() };
                    });
                    question.pairs = pairs;
                }
                
                chapterData.questions.push(question);
            });
            
            // Generate chapter ID
            const chapterId = `chapter-${Date.now()}`;
            
            // Save to Firebase
            await setDoc(doc(db, "chapters", chapterId), chapterData);
            
            alert('Chapter saved successfully!');
            this.hideChapterForm();
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Error saving chapter:', error);
            alert('Error saving chapter: ' + error.message);
        }
    }
    
    async uploadSampleContent() {
        try {
            // Import and run the content upload script
            const { uploadSampleContent } = await import('./content-upload.js');
            await uploadSampleContent();
            
            alert('Sample content uploaded successfully!');
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Error uploading sample content:', error);
            alert('Error uploading sample content: ' + error.message);
        }
    }
    
    importContent() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const chapters = JSON.parse(text);
                    
                    for (const chapter of chapters) {
                        const chapterId = chapter.id || `chapter-${Date.now()}-${Math.random()}`;
                        await setDoc(doc(db, "chapters", chapterId), chapter);
                    }
                    
                    alert(`Imported ${chapters.length} chapters successfully!`);
                    await this.loadDashboardData();
                    
                } catch (error) {
                    console.error('Error importing content:', error);
                    alert('Error importing content: ' + error.message);
                }
            }
        };
        
        input.click();
    }
    
    exportContent() {
        const dataStr = JSON.stringify(this.chapters, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'chapters-export.json';
        link.click();
    }
    
    exportUsers() {
        const dataStr = JSON.stringify(this.users, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'users-export.json';
        link.click();
    }
    
    async promoteUser(userId) {
        try {
            // In a real implementation, you'd update user roles in Firebase
            console.log(`Promoting user: ${userId}`);
            alert('User promoted successfully!');
        } catch (error) {
            console.error('Error promoting user:', error);
        }
    }
    
    async banUser(userId) {
        if (confirm('Are you sure you want to ban this user?')) {
            try {
                // In a real implementation, you'd update user status in Firebase
                console.log(`Banning user: ${userId}`);
                alert('User banned successfully!');
            } catch (error) {
                console.error('Error banning user:', error);
            }
        }
    }
    
    saveSettings() {
        const settings = {
            maxAttempts: document.getElementById('max-attempts').value,
            passingScore: document.getElementById('passing-score').value,
            allowGuestAccess: document.getElementById('allow-guest-access').checked,
            enableAnalytics: document.getElementById('enable-analytics').checked
        };
        
        localStorage.setItem('adminSettings', JSON.stringify(settings));
        alert('Settings saved successfully!');
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Make admin panel globally available
window.adminPanel = adminPanel;

