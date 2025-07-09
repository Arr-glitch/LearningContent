import { firebaseConfig } from "./firebase-config.js";
import AnalyticsSystem from "../analytics.js";
// Initialize Firebase using the global 'firebase' object
// This assumes firebase-app.js, firebase-auth.js, firebase-firestore.js
// are loaded as <script> tags in index.html BEFORE this script.
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // Access Firestore via global firebase
const auth = firebase.auth();   // Access Auth via global firebase
// User roles and privileges
const USER_ROLES = {
GUEST: 'guest',
STUDENT: 'student',
PREMIUM: 'premium',
TEACHER: 'teacher',
ADMIN: 'admin'
};
const ROLE_PRIVILEGES = {
[USER_ROLES.GUEST]: {
maxChapters: 2,
canSaveProgress: false,
canViewDashboard: false,
canAccessPremiumContent: false
},
[USER_ROLES.STUDENT]: {
maxChapters: Infinity,
canSaveProgress: true,
canViewDashboard: true,
canAccessPremiumContent: false
},
[USER_ROLES.PREMIUM]: {
maxChapters: Infinity,
canSaveProgress: true,
canViewDashboard: true,
canAccessPremiumContent: true,
canDownloadCertificates: true
},
[USER_ROLES.TEACHER]: {
maxChapters: Infinity,
canSaveProgress: true,
canViewDashboard: true,
canAccessPremiumContent: true,
canCreateContent: true,
canViewStudentProgress: true
},
[USER_ROLES.ADMIN]: {
maxChapters: Infinity,
canSaveProgress: true,
canViewDashboard: true,
canAccessPremiumContent: true,
canCreateContent: true,
canViewStudentProgress: true,
canManageUsers: true,
canAccessAdminPanel: true
}
};
// Application State
class LearningApp {
constructor() {
this.chapters = [];
this.currentChapterIndex = 0;
this.currentQuestionIndex = 0;
this.userProgress = {
score: 0,
totalQuestions: 0,
correctAnswers: 0,
completedChapters: [],
chapterProgress: {}
};
this.currentUser = null;
this.userRole = USER_ROLES.GUEST;
this.isAnswered = false;
this.questionStartTime = null;
this.analytics = new AnalyticsSystem();
    this.init();
}

async init() {
    try {
        // Set up authentication listener
        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            if (user) {
                await this.loadUserRole();
                this.analytics.setUserId(user.uid);
                await this.analytics.initializeUserStats(user.uid);
                await this.loadUserProgress();
            } else {
                this.userRole = USER_ROLES.GUEST;
            }
            this.updateUserPanel();
            this.updateUIBasedOnRole();
        });

        // Load chapters from Firebase
        await this.loadChapters();
        
        // Load progress from localStorage
        this.loadLocalProgress();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.updateUI();
        
        // Hide loading, show content
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
    } catch (error) {
        console.error('Initialization error:', error);
        this.showError();
    }
}

async loadUserRole() {
    try {
        if (!this.currentUser) return;
        
        const userDoc = await db.collection("users").doc(this.currentUser.uid).get();
        if (userDoc.exists) {
            this.userRole = userDoc.data().role || USER_ROLES.STUDENT;
        } else {
            // Create new user document with default role
            await db.collection("users").doc(this.currentUser.uid).set({
                email: this.currentUser.email,
                role: USER_ROLES.STUDENT,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            });
            this.userRole = USER_ROLES.STUDENT;
        }
    } catch (error) {
        console.error('Error loading user role:', error);
        this.userRole = USER_ROLES.STUDENT;
    }
}

updateUIBasedOnRole() {
    const privileges = ROLE_PRIVILEGES[this.userRole];
    
    // Show/hide dashboard link
    if (privileges.canViewDashboard) {
        this.addDashboardLink();
    }
    
    // Show/hide admin panel link
    if (privileges.canAccessAdminPanel) {
        this.addAdminPanelLink();
    }
    
    // Update chapter access
    this.updateChapterAccess();
    
    // Show role badge
    this.showRoleBadge();
}

addDashboardLink() {
    const userPanel = document.getElementById('user-panel');
    if (!document.getElementById('dashboard-link')) {
        const dashboardLink = document.createElement('a');
        dashboardLink.id = 'dashboard-link';
        dashboardLink.href = 'user-dashboard.html';
        dashboardLink.className = 'btn';
        dashboardLink.style.cssText = 'margin-left: 0.5rem; padding: 0.5rem 1rem; font-size: 0.8rem; text-decoration: none;';
        dashboardLink.textContent = 'Dashboard';
        userPanel.appendChild(dashboardLink);
    }
}

addAdminPanelLink() {
    const userPanel = document.getElementById('user-panel');
    if (!document.getElementById('admin-link')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-link';
        adminLink.href = 'admin-panel.html';
        adminLink.className = 'btn';
        adminLink.style.cssText = 'margin-left: 0.5rem; padding: 0.5rem 1rem; font-size: 0.8rem; text-decoration: none; background: linear-gradient(45deg, #ef4444, #dc2626);';
        adminLink.textContent = 'Admin';
        userPanel.appendChild(adminLink);
    }
}

showRoleBadge() {
    const userInfo = document.getElementById('user-info');
    let roleBadge = document.getElementById('role-badge');
    
    if (!roleBadge) {
        roleBadge = document.createElement('span');
        roleBadge.id = 'role-badge';
        roleBadge.style.cssText = 'font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 0.5rem; margin-left: 0.5rem;';
        userInfo.appendChild(roleBadge);
    }
    
    const roleColors = {
        [USER_ROLES.GUEST]: 'background: #6b7280; color: white;',
        [USER_ROLES.STUDENT]: 'background: #3b82f6; color: white;',
        [USER_ROLES.PREMIUM]: 'background: #f59e0b; color: white;',
        [USER_ROLES.TEACHER]: 'background: #10b981; color: white;',
        [USER_ROLES.ADMIN]: 'background: #ef4444; color: white;'
    };
    
    roleBadge.style.cssText += roleColors[this.userRole];
    roleBadge.textContent = this.userRole.toUpperCase();
}

updateChapterAccess() {
    const privileges = ROLE_PRIVILEGES[this.userRole];
    const maxChapters = privileges.maxChapters;
    
    // Update chapter selector dots
    const chapterDots = document.querySelectorAll('.chapter-dot');
    chapterDots.forEach((dot, index) => {
        if (index >= maxChapters) {
            dot.style.opacity = '0.3';
            dot.style.cursor = 'not-allowed';
            dot.title = 'Upgrade to access this chapter';
        } else {
            dot.style.opacity = '1';
            dot.style.cursor = 'pointer';
            dot.title = '';
        }
    });
}

async loadChapters() {
    try {
        const snapshot = await db.collection("chapters").orderBy("order").get();
        this.chapters = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        if (this.chapters.length === 0) {
            await this.loadSampleData();
        }
        
    } catch (error) {
        console.error('Error loading chapters:', error);
        await this.loadSampleData();
    }
}

async loadSampleData() {
    this.chapters = [
        {
            id: "chapter-1",
            title: "Chapter 1: Basic Grammar",
            lesson: "Understanding the fundamentals of English grammar is essential for effective communication.",
            explanation: "Grammar provides the structure and rules that help us form meaningful sentences.",
            examples: [
                "Subject + Verb + Object: 'She reads books.'",
                "Questions: 'What are you doing?'",
                "Negatives: 'I don't like coffee.'"
            ],
            difficulty: "beginner",
            isPremium: false,
            order: 1,
            questions: [
                {
                    type: "multiple-choice",
                    question: "What is the correct sentence structure?",
                    options: ["Verb + Subject + Object", "Subject + Verb + Object", "Object + Subject + Verb", "Subject + Object + Verb"],
                    correct: 1,
                    feedback: "The basic English sentence structure is Subject + Verb + Object.",
                    points: 10
                },
                {
                    type: "fill-in-blank",
                    question: "Complete the sentence: 'She _____ to school every day.'",
                    correct: ["goes", "walks", "drives"],
                    feedback: "Common verbs like 'goes', 'walks', or 'drives' fit this sentence.",
                    points: 10
                }
            ]
        },
        {
            id: "chapter-2",
            title: "Chapter 2: Vocabulary Building",
            lesson: "Expanding your vocabulary is crucial for improving your English communication skills.",
            explanation: "A rich vocabulary allows you to express yourself more precisely and understand others better.",
            examples: [
                "Synonyms: big, large, huge, enormous",
                "Antonyms: hot vs. cold, fast vs. slow",
                "Context clues: 'The enormous elephant...' (enormous = very big)"
            ],
            difficulty: "intermediate",
            isPremium: false,
            order: 2,
            questions: [
                {
                    type: "matching",
                    question: "Match the words with their meanings:",
                    pairs: [
                        { left: "Enormous", right: "Very large" },
                        { left: "Tiny", right: "Very small" },
                        { left: "Ancient", right: "Very old" }
                    ],
                    feedback: "Great job matching the words with their meanings!",
                    points: 15
                }
            ]
        },
        {
            id: "chapter-3",
            title: "Chapter 3: Reading Comprehension (Premium)",
            lesson: "Developing strong reading comprehension skills helps you understand and analyze texts effectively.",
            explanation: "Reading comprehension involves understanding the main ideas, supporting details, and implied meanings in texts.",
            examples: [
                "Main idea: The central point of a paragraph or text",
                "Supporting details: Facts and examples that support the main idea",
                "Inference: Understanding what is implied but not directly stated"
            ],
            difficulty: "advanced",
            isPremium: true,
            order: 3,
            questions: [
                {
                    type: "reading-passage",
                    passage: "The library is a wonderful place to study and learn. It offers a quiet environment where students can focus on their work. Many resources, including books, journals, and digital archives, are available to help with research and academic pursuits. Librarians are always ready to assist visitors in finding the information they need.",
                    question: "What is the main idea of this passage?",
                    options: [
                        "Libraries have many books",
                        "Students like to study",
                        "Libraries are excellent places for learning and studying",
                        "Librarians are helpful"
                    ],
                    correct: 2,
                    feedback: "Correct! The main idea is that libraries are excellent places for learning and studying.",
                    points: 25
                }
            ]
        }
    ];
}

setupEventListeners() {
    // Navigation buttons
    document.getElementById('prev-chapter').addEventListener('click', () => this.previousChapter());
    document.getElementById('next-chapter').addEventListener('click', () => this.nextChapter());
    
    // Question buttons
    document.getElementById('submit-answer').addEventListener('click', () => this.submitAnswer());
    document.getElementById('next-question').addEventListener('click', () => this.nextQuestion());
    document.getElementById('show-explanation').addEventListener('click', () => this.showExplanation());
    
    // Progress controls
    document.getElementById('reset-progress').addEventListener('click', () => this.resetProgress());
    document.getElementById('complete-chapter').addEventListener('click', () => this.completeChapter());
    
    // Authentication
    document.getElementById('auth-btn').addEventListener('click', () => this.toggleAuth());
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    
    // Track session end
    window.addEventListener('beforeunload', () => {
        this.analytics.trackStudySession();
    });
}

updateUI() {
    if (this.chapters.length === 0) return;
    
    const chapter = this.chapters[this.currentChapterIndex];
    
    // Check if user can access this chapter
    if (!this.canAccessChapter(chapter)) {
        this.showUpgradePrompt(chapter);
        return;
    }
    
    // Update chapter content
    document.getElementById('chapter-title').textContent = chapter.title;
    document.getElementById('lesson-text').textContent = chapter.lesson;
    document.getElementById('explanation-text').textContent = chapter.explanation;
    
    // Update examples
    const examplesList = document.getElementById('examples-list');
    examplesList.innerHTML = '';
    chapter.examples.forEach(example => {
        const li = document.createElement('li');
        li.textContent = example;
        examplesList.appendChild(li);
    });
    
    // Update progress
    this.updateProgress();
    
    // Update chapter selector
    this.updateChapterSelector();
    
    // Load first question
    this.currentQuestionIndex = 0;
    this.loadQuestion();
}

canAccessChapter(chapter) {
    const privileges = ROLE_PRIVILEGES[this.userRole];
    
    if (chapter.isPremium && !privileges.canAccessPremiumContent) {
        return false;
    }
    
    const chapterIndex = this.chapters.indexOf(chapter);
    return chapterIndex < privileges.maxChapters;
}

showUpgradePrompt(chapter) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem;">
            <h1 style="margin-bottom: 2rem;">🔒 Premium Content</h1>
            <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.8;">
                "${chapter.title}" is available for premium users only.
            </p>
            <div style="background: rgba(255,255,255,0.1); border-radius: 1rem; padding: 2rem; margin: 2rem 0;">
                <h3 style="margin-bottom: 1rem;">Upgrade to Premium to unlock:</h3>
                <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                    <li>✅ Access to all chapters</li>
                    <li>✅ Advanced question types</li>
                    <li>✅ Detailed analytics</li>
                    <li>✅ Certificate downloads</li>
                    <li>✅ Priority support</li>
                </ul>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn primary" onclick="app.upgradeToPremium()">Upgrade to Premium</button>
                <button class="btn" onclick="app.goToChapter(0)">Back to Free Chapters</button>
            </div>
        </div>
    `;
}

upgradeToPremium() {
    alert('Premium upgrade feature would be implemented here with payment processing.');
}

loadQuestion() {
    const chapter = this.chapters[this.currentChapterIndex];
    if (!chapter.questions || chapter.questions.length === 0) return;
    
    const question = chapter.questions[this.currentQuestionIndex];
    this.isAnswered = false;
    this.questionStartTime = Date.now();
    
    // Update question info
    document.getElementById('question-number').textContent = this.currentQuestionIndex + 1;
    document.getElementById('total-questions').textContent = chapter.questions.length;
    document.getElementById('question-text').textContent = question.question;
    
    // Hide all question containers
    this.hideAllQuestionContainers();
    
    // Show appropriate question type
    switch (question.type) {
        case 'multiple-choice':
            this.loadMultipleChoice(question);
            break;
        case 'fill-in-blank':
            this.loadFillInBlank(question);
            break;
        case 'drag-drop':
            this.loadDragDrop(question);
            break;
        case 'matching':
            this.loadMatching(question);
            break;
        case 'reading-passage':
            this.loadReadingPassage(question);
            break;
    }
    
    // Reset buttons
    document.getElementById('submit-answer').style.display = 'block';
    document.getElementById('next-question').style.display = 'none';
    document.getElementById('show-explanation').style.display = 'none';
    document.getElementById('feedback').style.display = 'none';
}

hideAllQuestionContainers() {
    document.getElementById('options-container').style.display = 'none';
    document.getElementById('fill-blank-container').style.display = 'none';
    document.getElementById('drag-drop-container').style.display = 'none';
    document.getElementById('matching-container').style.display = 'none';
    document.getElementById('reading-container').style.display = 'none';
}

loadMultipleChoice(question) {
    const container = document.getElementById('options-container');
    container.style.display = 'block';
    container.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.innerHTML = `
            <div class="option-letter">${String.fromCharCode(65 + index)}</div>
            <span>${option}</span>
        `;
        optionDiv.addEventListener('click', () => this.selectOption(optionDiv, index));
        container.appendChild(optionDiv);
    });
}

loadFillInBlank(question) {
    const container = document.getElementById('fill-blank-container');
    container.style.display = 'block';
    
    document.getElementById('fill-blank-question').textContent = question.question;
    const input = document.getElementById('fill-blank-input');
    input.value = '';
    input.focus();
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            this.submitAnswer();
        }
    });
}

loadDragDrop(question) {
    const container = document.getElementById('drag-drop-container');
    container.style.display = 'block';
    
    const itemsContainer = document.getElementById('drag-items');
    const dropZone = document.getElementById('drop-zone');
    
    itemsContainer.innerHTML = '';
    dropZone.innerHTML = '<span style="opacity: 0.5;">Drag items here to form the correct order</span>';
    
    // Shuffle items
    const shuffledItems = [...question.items].sort(() => Math.random() - 0.5);
    
    shuffledItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'drag-item';
        itemDiv.textContent = item;
        itemDiv.draggable = true;
        
        itemDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item);
            itemDiv.classList.add('dragging');
        });
        
        itemDiv.addEventListener('dragend', () => {
            itemDiv.classList.remove('dragging');
        });
        
        itemsContainer.appendChild(itemDiv);
    });
    
    this.setupDropZone(dropZone);
}

setupDropZone(dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const item = e.dataTransfer.getData('text/plain');
        const itemDiv = document.createElement('div');
        itemDiv.className = 'drag-item';
        itemDiv.textContent = item;
        
        // Remove from original container
        const originalItem = Array.from(document.querySelectorAll('.drag-item'))
            .find(el => el.textContent === item && el.parentElement.id === 'drag-items');
        if (originalItem) {
            originalItem.remove();
        }
        
        // Add to drop zone
        if (dropZone.children.length === 1 && dropZone.children[0].tagName === 'SPAN') {
            dropZone.innerHTML = '';
        }
        dropZone.appendChild(itemDiv);
    });
}

loadMatching(question) {
    const container = document.getElementById('matching-container');
    container.style.display = 'block';
    
    const leftColumn = document.getElementById('left-column');
    const rightColumn = document.getElementById('right-column');
    
    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';
    
    // Shuffle right column items
    const rightItems = [...question.pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
    
    question.pairs.forEach((pair, index) => {
        const leftItem = document.createElement('div');
        leftItem.className = 'matching-item';
        leftItem.textContent = pair.left;
        leftItem.dataset.index = index;
        leftItem.addEventListener('click', () => this.selectMatchingItem(leftItem, 'left'));
        leftColumn.appendChild(leftItem);
    });
    
    rightItems.forEach((item, index) => {
        const rightItem = document.createElement('div');
        rightItem.className = 'matching-item';
        rightItem.textContent = item;
        rightItem.dataset.value = item;
        rightItem.addEventListener('click', () => this.selectMatchingItem(rightItem, 'right'));
        rightColumn.appendChild(rightItem);
    });
    
    this.selectedMatching = { left: null, right: null };
    this.matchedPairs = [];
}

loadReadingPassage(question) {
    const container = document.getElementById('reading-container');
    container.style.display = 'block';
    
    document.getElementById('reading-passage').textContent = question.passage;
    
    const optionsContainer = document.getElementById('reading-options');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.innerHTML = `
            <div class="option-letter">${String.fromCharCode(65 + index)}</div>
            <span>${option}</span>
        `;
        optionDiv.addEventListener('click', () => this.selectOption(optionDiv, index));
        optionsContainer.appendChild(optionDiv);
    });
}

selectOption(optionElement, index) {
    if (this.isAnswered) return;
    
    // Remove previous selections
    document.querySelectorAll('.option.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection
    optionElement.classList.add('selected');
    this.selectedAnswer = index;
}

selectMatchingItem(item, side) {
    if (this.isAnswered) return;
    
    // Remove previous selections from this side
    document.querySelectorAll(`.matching-item.selected`).forEach(el => {
        if ((side === 'left' && el.parentElement.id === 'left-column') ||
            (side === 'right' && el.parentElement.id === 'right-column')) {
            el.classList.remove('selected');
        }
    });
    
    item.classList.add('selected');
    this.selectedMatching[side] = item;
    
    // Check if both sides are selected
    if (this.selectedMatching.left && this.selectedMatching.right) {
        this.matchPair();
    }
}

matchPair() {
    const leftItem = this.selectedMatching.left;
    const rightItem = this.selectedMatching.right;
    
    const leftIndex = parseInt(leftItem.dataset.index);
    const rightValue = rightItem.dataset.value;
    
    const chapter = this.chapters[this.currentChapterIndex];
    const question = chapter.questions[this.currentQuestionIndex];
    const correctPair = question.pairs[leftIndex];
    
    if (correctPair.right === rightValue) {
        // Correct match
        leftItem.classList.add('matched');
        rightItem.classList.add('matched');
        this.matchedPairs.push({ left: leftIndex, right: rightValue });
    }
    
    // Reset selections
    leftItem.classList.remove('selected');
    rightItem.classList.remove('selected');
    this.selectedMatching = { left: null, right: null };
}

submitAnswer() {
    if (this.isAnswered) return;
    
    const chapter = this.chapters[this.currentChapterIndex];
    const question = chapter.questions[this.currentQuestionIndex];
    let isCorrect = false;
    let userAnswer = null;
    
    switch (question.type) {
        case 'multiple-choice':
        case 'reading-passage':
            userAnswer = this.selectedAnswer;
            if (Array.isArray(question.correct)) {
                isCorrect = question.correct.includes(userAnswer);
            } else {
                isCorrect = userAnswer === question.correct;
            }
            this.highlightMultipleChoiceAnswers(question, userAnswer);
            break;
            
        case 'fill-in-blank':
            userAnswer = document.getElementById('fill-blank-input').value.trim().toLowerCase();
            isCorrect = question.correct.some(answer => 
                answer.toLowerCase() === userAnswer
            );
            break;
            
        case 'drag-drop':
            const dropZone = document.getElementById('drop-zone');
            userAnswer = Array.from(dropZone.children).map(item => item.textContent);
            isCorrect = JSON.stringify(userAnswer) === JSON.stringify(question.correct);
            break;
            
        case 'matching':
            isCorrect = this.matchedPairs.length === question.pairs.length;
            break;
    }
    
    this.isAnswered = true;
    
    // Track analytics
    const timeSpent = Date.now() - this.questionStartTime;
    this.analytics.trackQuestionAttempt(question.type, isCorrect, timeSpent);
    
    this.showFeedback(question.feedback, isCorrect);
    this.updateScore(isCorrect, question.points || 10);
    
    // Update buttons
    document.getElementById('submit-answer').style.display = 'none';
    if (this.currentQuestionIndex < chapter.questions.length - 1) {
        document.getElementById('next-question').style.display = 'block';
    } else {
        document.getElementById('complete-chapter').style.display = 'block';
    }
    document.getElementById('show-explanation').style.display = 'block';
    
    // Check achievements
    if (this.currentUser) {
        this.analytics.checkAchievements();
    }
}

highlightMultipleChoiceAnswers(question, userAnswer) {
    const options = document.querySelectorAll('.option');
    
    if (Array.isArray(question.correct)) {
        question.correct.forEach(correctIndex => {
            options[correctIndex].classList.add('correct');
        });
        if (userAnswer !== undefined && !question.correct.includes(userAnswer)) {
            options[userAnswer].classList.add('incorrect');
        }
    } else {
        options[question.correct].classList.add('correct');
        if (userAnswer !== undefined && userAnswer !== question.correct) {
            options[userAnswer].classList.add('incorrect');
        }
    }
}

showFeedback(feedback, isCorrect) {
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.textContent = feedback;
    feedbackElement.className = isCorrect ? 'feedback' : 'feedback incorrect';
    feedbackElement.style.display = 'block';
}

updateScore(isCorrect, points) {
    this.userProgress.totalQuestions++;
    if (isCorrect) {
        this.userProgress.correctAnswers++;
        this.userProgress.score += points;
    }
    
    this.updateProgress();
    this.saveProgress();
}

updateProgress() {
    const accuracy = this.userProgress.totalQuestions > 0 
        ? Math.round((this.userProgress.correctAnswers / this.userProgress.totalQuestions) * 100)
        : 0;
    
    document.getElementById('total-score').textContent = this.userProgress.score;
    document.getElementById('accuracy').textContent = `${accuracy}%`;
    document.getElementById('chapters-completed').textContent = 
        `${this.userProgress.completedChapters.length}/${this.chapters.length}`;
    
    // Update progress bar
    const overallProgress = this.userProgress.completedChapters.length / this.chapters.length * 100;
    document.getElementById('progress-fill').style.width = `${overallProgress}%`;
}

updateChapterSelector() {
    const selector = document.getElementById('chapter-selector');
    selector.innerHTML = '';
    
    this.chapters.forEach((chapter, index) => {
        const dot = document.createElement('div');
        dot.className = 'chapter-dot';
        if (index === this.currentChapterIndex) {
            dot.classList.add('active');
        }
        if (this.userProgress.completedChapters.includes(chapter.id)) {
            dot.classList.add('completed');
        }
        
        // Check access
        if (this.canAccessChapter(chapter)) {
            dot.addEventListener('click', () => this.goToChapter(index));
        } else {
            dot.style.opacity = '0.3';
            dot.style.cursor = 'not-allowed';
            dot.title = chapter.isPremium ? 'Premium content' : 'Upgrade to access';
        }
        
        selector.appendChild(dot);
    });
}

nextQuestion() {
    const chapter = this.chapters[this.currentChapterIndex];
    if (this.currentQuestionIndex < chapter.questions.length - 1) {
        this.currentQuestionIndex++;
        this.loadQuestion();
    }
}

previousChapter() {
    if (this.currentChapterIndex > 0) {
        this.currentChapterIndex--;
        this.updateUI();
    }
}

nextChapter() {
    if (this.currentChapterIndex < this.chapters.length - 1) {
        const nextChapter = this.chapters[this.currentChapterIndex + 1];
        if (this.canAccessChapter(nextChapter)) {
            this.currentChapterIndex++;
            this.updateUI();
        } else {
            this.showUpgradePrompt(nextChapter);
        }
    }
}

goToChapter(index) {
    const chapter = this.chapters[index];
    if (this.canAccessChapter(chapter)) {
        this.currentChapterIndex = index;
        this.updateUI();
    } else {
        this.showUpgradePrompt(chapter);
    }
}

completeChapter() {
    const chapter = this.chapters[this.currentChapterIndex];
    if (!this.userProgress.completedChapters.includes(chapter.id)) {
        this.userProgress.completedChapters.push(chapter.id);
        this.userProgress.score += 50; // Bonus for completing chapter
        
        // Calculate chapter accuracy
        const chapterQuestions = chapter.questions.length;
        const chapterCorrect = this.userProgress.correctAnswers;
        const accuracy = chapterQuestions > 0 ? (chapterCorrect / chapterQuestions) * 100 : 0;
        
        // Track chapter completion
        this.analytics.trackChapterCompletion(chapter.id, accuracy);
    }
    
    this.updateProgress();
    this.saveProgress();
    this.updateChapterSelector();
    
    // Show completion message
    this.showChapterCompletionMessage();
    
    // Move to next chapter if available
    if (this.currentChapterIndex < this.chapters.length - 1) {
        setTimeout(() => {
            const nextChapter = this.chapters[this.currentChapterIndex + 1];
            if (this.canAccessChapter(nextChapter)) {
                this.nextChapter();
            }
        }, 2000);
    }
}

showChapterCompletionMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #22c55e, #16a34a);
        color: white;
        padding: 2rem;
        border-radius: 1rem;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    `;
    
    message.innerHTML = `
        <h2 style="margin-bottom: 1rem;">🎉 Chapter Complete!</h2>
        <p>Great job completing this chapter!</p>
        <p style="margin-top: 1rem; font-weight: bold;">+50 bonus points</p>
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
    }, 3000);
}

showExplanation() {
    const chapter = this.chapters[this.currentChapterIndex];
    alert(`Explanation:\n\n${chapter.explanation}`);
}

resetProgress() {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        this.userProgress = {
            score: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            completedChapters: [],
            chapterProgress: {}
        };
        this.currentChapterIndex = 0;
        this.currentQuestionIndex = 0;
        
        localStorage.removeItem('learningProgress');
        if (this.currentUser) {
            this.saveUserProgress();
        }
        
        this.updateUI();
    }
}

handleKeyboard(e) {
    switch (e.key) {
        case 'ArrowLeft':
            this.previousChapter();
            break;
        case 'ArrowRight':
            this.nextChapter();
            break;
        case 'Enter':
            if (!this.isAnswered) {
                this.submitAnswer();
            } else {
                this.nextQuestion();
            }
            break;
    }
}

saveProgress() {
    const privileges = ROLE_PRIVILEGES[this.userRole];
    
    if (privileges.canSaveProgress) {
        localStorage.setItem('learningProgress', JSON.stringify(this.userProgress));
        if (this.currentUser) {
            this.saveUserProgress();
        }
    }
}

loadLocalProgress() {
    const saved = localStorage.getItem('learningProgress');
    if (saved) {
        this.userProgress = { ...this.userProgress, ...JSON.parse(saved) };
    }
}

async saveUserProgress() {
    if (!this.currentUser) return;
    
    try {
        await db.collection("userProgress").doc(this.currentUser.uid).set({
            ...this.userProgress,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving user progress:', error);
    }
}

async loadUserProgress() {
    if (!this.currentUser) return;
    
    try {
        const docSnap = await db.collection("userProgress").doc(this.currentUser.uid).get();
        if (docSnap.exists) {
            this.userProgress = { ...this.userProgress, ...docSnap.data() };
            this.updateProgress();
        }
    } catch (error) {
        console.error('Error loading user progress:', error);
    }
}

updateUserPanel() {
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const authBtn = document.getElementById('auth-btn');
    
    if (this.currentUser) {
        userAvatar.textContent = this.currentUser.email.charAt(0).toUpperCase();
        userName.textContent = this.currentUser.email.split('@')[0];
        authBtn.textContent = 'Logout';
    } else {
        userAvatar.textContent = 'G';
        userName.textContent = 'Guest';
        authBtn.textContent = 'Login';
    }
}

toggleAuth() {
    if (this.currentUser) {
        this.logout();
    } else {
        this.showAuthModal();
    }
}

async logout() {
    try {
        this.analytics.trackStudySession();
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

showAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: white; padding: 2rem; border-radius: 1rem; max-width: 400px; width: 90%;">
                <h3 style="color: #333; margin-bottom: 1rem;">Login / Register</h3>
                <input type="email" id="auth-email" placeholder="Email" style="width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 0.5rem;">
                <input type="password" id="auth-password" placeholder="Password" style="width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 0.5rem;">
                <div style="display: flex; gap: 1rem;">
                    <button onclick="app.login()" style="flex: 1; padding: 0.8rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Login</button>
                    <button onclick="app.register()" style="flex: 1; padding: 0.8rem; background: #22c55e; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Register</button>
                    <button onclick="app.closeAuthModal()" style="padding: 0.8rem; background: #ef4444; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Cancel</button>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

async login() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        this.closeAuthModal();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async register() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        this.closeAuthModal();
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
}

closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

showError() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
}
}
// Initialize the application
window.app = new LearningApp();