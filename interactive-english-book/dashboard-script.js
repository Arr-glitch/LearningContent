import { initializeApp } from "./lib/firebase-app.js";
import { getFirestore, doc, getDoc } from "./lib/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "./lib/firebase-auth.js";
import { firebaseConfig } from "./assets/firebase-config.js";
import AnalyticsSystem from "./analytics.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

class UserDashboard {
    constructor() {
        this.currentUser = null;
        this.analytics = new AnalyticsSystem();
        this.userStats = null;
        this.achievements = [];
        
        this.init();
    }
    
    async init() {
        // Set up authentication listener
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;
            if (user) {
                await this.loadUserData();
                this.renderDashboard();
            } else {
                this.showGuestMessage();
            }
        });
    }
    
    async loadUserData() {
        try {
            // Load user statistics
            const userStatsRef = doc(db, "userStats", this.currentUser.uid);
            const userStatsDoc = await getDoc(userStatsRef);
            
            if (userStatsDoc.exists()) {
                this.userStats = userStatsDoc.data();
            } else {
                // Initialize empty stats for new users
                this.userStats = {
                    totalQuestions: 0,
                    correctAnswers: 0,
                    totalStudyTime: 0,
                    studyStreak: 0,
                    completedChapters: 0,
                    achievements: [],
                    questionTypes: {},
                    dailyStudy: {}
                };
            }
            
            // Load user progress
            const userProgressRef = doc(db, "userProgress", this.currentUser.uid);
            const userProgressDoc = await getDoc(userProgressRef);
            
            if (userProgressDoc.exists()) {
                const progressData = userProgressDoc.data();
                this.userStats.score = progressData.score || 0;
                this.userStats.completedChapters = progressData.completedChapters?.length || 0;
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    renderDashboard() {
        this.renderOverallProgress();
        this.renderStudyStreak();
        this.renderAchievements();
        this.renderWeeklyProgress();
        this.renderQuestionTypePerformance();
        this.renderStrengths();
        this.renderRecommendations();
    }
    
    renderOverallProgress() {
        const stats = this.userStats;
        const accuracy = stats.totalQuestions > 0 
            ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
            : 0;
        
        // Update progress ring
        const progressCircle = document.getElementById('overall-progress');
        const circumference = 2 * Math.PI * 52;
        const progress = Math.min(accuracy, 100);
        const strokeDasharray = `${(progress / 100) * circumference} ${circumference}`;
        
        progressCircle.style.strokeDasharray = strokeDasharray;
        document.getElementById('overall-percentage').textContent = `${accuracy}%`;
        
        // Update stats
        document.getElementById('total-score').textContent = stats.score || 0;
        document.getElementById('accuracy-rate').textContent = `${accuracy}%`;
        document.getElementById('chapters-done').textContent = stats.completedChapters || 0;
        document.getElementById('study-time').textContent = this.formatTime(stats.totalStudyTime || 0);
    }
    
    renderStudyStreak() {
        const streak = this.userStats.studyStreak || 0;
        document.getElementById('streak-count').textContent = streak;
        
        // Render calendar
        const calendar = document.getElementById('streak-calendar');
        calendar.innerHTML = '';
        
        const today = new Date();
        const dailyStudy = this.userStats.dailyStudy || {};
        
        // Show last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateString = date.toDateString();
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = date.getDate();
            
            if (dailyStudy[dateString]) {
                dayElement.classList.add('studied');
            }
            
            if (i === 0) {
                dayElement.classList.add('today');
            }
            
            calendar.appendChild(dayElement);
        }
    }
    
    renderAchievements() {
        const achievementsGrid = document.getElementById('achievements-grid');
        achievementsGrid.innerHTML = '';
        
        const userAchievements = this.userStats.achievements || [];
        
        this.analytics.achievements.forEach(achievement => {
            const isEarned = userAchievements.includes(achievement.id);
            const canEarn = achievement.condition(this.userStats);
            
            const achievementElement = document.createElement('div');
            achievementElement.className = `achievement-item ${isEarned ? 'earned' : canEarn ? 'available' : 'locked'}`;
            
            achievementElement.innerHTML = `
                <span class="achievement-icon">${achievement.icon}</span>
                <div class="achievement-title">${achievement.title}</div>
                <div class="achievement-description">${achievement.description}</div>
                <div class="achievement-points">${isEarned ? 'Earned!' : `${achievement.points} points`}</div>
            `;
            
            achievementsGrid.appendChild(achievementElement);
        });
    }
    
    renderWeeklyProgress() {
        const chartContainer = document.getElementById('weekly-chart');
        chartContainer.innerHTML = '';
        
        const dailyStudy = this.userStats.dailyStudy || {};
        const today = new Date();
        
        // Show last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateString = date.toDateString();
            
            const studyData = dailyStudy[dateString];
            const questionsAnswered = studyData ? studyData.questionsAnswered : 0;
            const maxQuestions = 20; // Normalize to max 20 questions per day
            const height = Math.max((questionsAnswered / maxQuestions) * 160, 10);
            
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${height}px`;
            bar.title = `${questionsAnswered} questions on ${date.toLocaleDateString()}`;
            
            const label = document.createElement('div');
            label.className = 'chart-label';
            label.textContent = date.toLocaleDateString('en', { weekday: 'short' });
            
            bar.appendChild(label);
            chartContainer.appendChild(bar);
        }
    }
    
    renderQuestionTypePerformance() {
        const container = document.getElementById('question-types-chart');
        container.innerHTML = '';
        
        const questionTypes = this.userStats.questionTypes || {};
        
        Object.entries(questionTypes).forEach(([type, data]) => {
            if (data.total > 0) {
                const accuracy = Math.round((data.correct / data.total) * 100);
                const typeName = type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                const typeElement = document.createElement('div');
                typeElement.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                `;
                
                typeElement.innerHTML = `
                    <span>${typeName}</span>
                    <span style="color: ${accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444'}">
                        ${accuracy}% (${data.correct}/${data.total})
                    </span>
                `;
                
                container.appendChild(typeElement);
            }
        });
        
        if (Object.keys(questionTypes).length === 0) {
            container.innerHTML = '<p style="opacity: 0.6; text-align: center;">No question data yet. Start learning to see your performance!</p>';
        }
    }
    
    renderStrengths() {
        const strengthsList = document.getElementById('strengths-list');
        strengthsList.innerHTML = '';
        
        const questionTypes = this.userStats.questionTypes || {};
        const strengths = [];
        
        Object.entries(questionTypes).forEach(([type, data]) => {
            if (data.total >= 3) {
                const accuracy = (data.correct / data.total) * 100;
                if (accuracy >= 80) {
                    strengths.push({
                        type: type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        accuracy: Math.round(accuracy)
                    });
                }
            }
        });
        
        if (strengths.length > 0) {
            strengths.forEach(strength => {
                const strengthTag = document.createElement('div');
                strengthTag.className = 'strength-tag';
                strengthTag.textContent = `${strength.type} (${strength.accuracy}%)`;
                strengthsList.appendChild(strengthTag);
            });
        } else {
            strengthsList.innerHTML = '<p style="opacity: 0.6;">Keep practicing to discover your strengths!</p>';
        }
    }
    
    renderRecommendations() {
        const recommendationsList = document.getElementById('recommendations-list');
        recommendationsList.innerHTML = '';
        
        const recommendations = this.generateRecommendations();
        
        if (recommendations.length > 0) {
            recommendations.forEach(rec => {
                const recElement = document.createElement('li');
                recElement.className = `recommendation-item ${rec.type}`;
                recElement.textContent = rec.message;
                recommendationsList.appendChild(recElement);
            });
        } else {
            recommendationsList.innerHTML = '<li style="opacity: 0.6;">Great job! Keep up the excellent work!</li>';
        }
    }
    
    generateRecommendations() {
        const recommendations = [];
        const stats = this.userStats;
        const questionTypes = stats.questionTypes || {};
        
        // Check for weak areas
        Object.entries(questionTypes).forEach(([type, data]) => {
            if (data.total >= 5) {
                const accuracy = (data.correct / data.total) * 100;
                if (accuracy < 60) {
                    recommendations.push({
                        type: 'improvement',
                        message: `Focus on ${type.replace('-', ' ')} questions - current accuracy: ${Math.round(accuracy)}%`
                    });
                }
            }
        });
        
        // Study streak recommendations
        const streak = stats.studyStreak || 0;
        if (streak === 0) {
            recommendations.push({
                type: 'streak',
                message: 'Start a study streak! Try to study for at least 10 minutes daily.'
            });
        } else if (streak < 7) {
            recommendations.push({
                type: 'streak',
                message: `Great ${streak}-day streak! Keep going to reach the 7-day milestone.`
            });
        }
        
        // Chapter completion recommendations
        const completed = stats.completedChapters || 0;
        if (completed < 3) {
            recommendations.push({
                type: 'progress',
                message: 'Try to complete more chapters to unlock advanced topics.'
            });
        }
        
        // Accuracy recommendations
        const overallAccuracy = stats.totalQuestions > 0 
            ? (stats.correctAnswers / stats.totalQuestions) * 100
            : 0;
        
        if (overallAccuracy < 70 && stats.totalQuestions >= 10) {
            recommendations.push({
                type: 'improvement',
                message: 'Review lesson content before attempting questions to improve accuracy.'
            });
        }
        
        return recommendations;
    }
    
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }
    
    showGuestMessage() {
        document.querySelector('.dashboard-container').innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem;">
                <h1 style="margin-bottom: 2rem;">Welcome to Your Dashboard</h1>
                <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.8;">
                    Please log in to view your learning progress and achievements.
                </p>
                <button class="btn primary" onclick="window.location.href='index.html'">
                    Go to Learning Platform
                </button>
            </div>
        `;
    }
}

// Initialize dashboard
const dashboard = new UserDashboard();

