document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Particles.js background
    particlesJS("particles-js", {
        "particles": {
            "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
            "color": { "value": "#00f2fe" },
            "shape": { "type": "circle" },
            "opacity": { "value": 0.5, "random": true },
            "size": { "value": 3, "random": true },
            "line_linked": {
                "enable": true,
                "distance": 150,
                "color": "#4facfe",
                "opacity": 0.2,
                "width": 1
            },
            "move": {
                "enable": true,
                "speed": 2,
                "direction": "none",
                "random": true,
                "straight": false,
                "out_mode": "out",
                "bounce": false
            }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": {
                "onhover": { "enable": true, "mode": "grab" },
                "onclick": { "enable": true, "mode": "push" },
                "resize": true
            },
            "modes": {
                "grab": { "distance": 140, "line_linked": { "opacity": 0.8 } },
                "push": { "particles_nb": 4 }
            }
        },
        "retina_detect": true
    });

    // Navigation handling
    const links = document.querySelectorAll('nav a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            links.forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Form submission
    const form = document.getElementById('prediction-form');
    const resultsDiv = document.getElementById('results');
    const revenueResult = document.getElementById('revenue-result');
    const verdictResult = document.getElementById('verdict-result');
    const submitBtn = form.querySelector('.primary-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Update button state to loading
        btnText.textContent = 'Simulating...';
        spinner.classList.add('active');
        submitBtn.disabled = true;
        
        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Convert numbers
            for (let key in data) {
                if (key !== 'genre') {
                    data[key] = parseFloat(data[key]);
                }
            }

            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Prediction failed');
            }

            const result = await response.json();
            
            // Format revenue
            const formattedRevenue = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0
            }).format(result.predicted_revenue);

            // Add counter animation for revenue
            animateValue(revenueResult, 0, result.predicted_revenue, 1500, true);
            
            verdictResult.textContent = result.verdict;
            
            // Apply verdict styling
            verdictResult.className = 'result-value'; // reset
            if (result.verdict.toLowerCase() === 'hit') {
                verdictResult.classList.add('verdict-hit');
            } else if (result.verdict.toLowerCase() === 'flop') {
                verdictResult.classList.add('verdict-flop');
            }

            resultsDiv.classList.remove('hidden');
            
            // Scroll to results
            setTimeout(() => {
                resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during prediction.');
        } finally {
            btnText.textContent = 'Run Simulation';
            spinner.classList.remove('active');
            submitBtn.disabled = false;
        }
    });

    // Load Metrics and Dashboard Data
    loadModelMetrics();
    loadDashboardData();
});

// Animate a number counting up
function animateValue(obj, start, end, duration, formatCurrency = false) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function for smooth deceleration
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentVal = Math.floor(easeOutQuart * (end - start) + start);
        
        if (formatCurrency) {
            obj.innerHTML = new Intl.NumberFormat('en-US', {
                style: 'currency', currency: 'USD', maximumFractionDigits: 0
            }).format(currentVal);
        } else {
            obj.innerHTML = currentVal + '%';
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Function to animate circular gauges
function animateGauge(gaugeId, textId, targetPercentage, color) {
    let circularProgress = document.getElementById(gaugeId);
    let progressValue = document.getElementById(textId);
    
    let progressStartValue = 0;    
    let speed = 20;
    
    let progress = setInterval(() => {
        progressStartValue++;
        
        // Just animating the number and the gradient
        progressValue.textContent = `${progressStartValue}%`;
        circularProgress.style.background = `conic-gradient(${color} ${progressStartValue * 3.6}deg, rgba(255,255,255,0.05) 0deg)`;

        if(progressStartValue >= Math.floor(targetPercentage)){
            // Set the exact decimal at the end
            progressValue.textContent = `${targetPercentage}%`;
            clearInterval(progress);
        }    
    }, speed);
}

async function loadModelMetrics() {
    try {
        const response = await fetch('/model-metrics');
        if (!response.ok) throw new Error('Failed to fetch metrics');
        
        const data = await response.json();
        
        // Start intersection observer to trigger gauge animation only when visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateGauge('accuracy-gauge', 'accuracy-text', data.accuracy, '#00ff87');
                    animateGauge('r2-gauge', 'r2-text', data.r2_score, '#00f2fe');
                    observer.disconnect(); // Only animate once
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(document.getElementById('metrics'));
        
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

async function loadDashboardData() {
    try {
        const response = await fetch('/eda-data');
        if (!response.ok) throw new Error('Failed to fetch EDA data');
        
        const data = await response.json();
        
        if (data.error) {
            console.warn(data.error);
            return;
        }

        // Global Chart Defaults for Dark Theme
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Outfit', sans-serif";
        Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
        Chart.defaults.scale.grid.borderColor = 'rgba(255, 255, 255, 0.1)';

        // 1. Revenue by Genre (Bar Chart)
        const ctxRevenue = document.getElementById('revenueGenreChart').getContext('2d');
        const sortedGenresRev = Object.keys(data.genre_revenues).sort((a,b) => data.genre_revenues[b] - data.genre_revenues[a]).slice(0, 10);
        
        // Create Gradient
        let gradientBar = ctxRevenue.createLinearGradient(0, 0, 0, 400);
        gradientBar.addColorStop(0, 'rgba(0, 242, 254, 0.8)');
        gradientBar.addColorStop(1, 'rgba(79, 172, 254, 0.2)');

        new Chart(ctxRevenue, {
            type: 'bar',
            data: {
                labels: sortedGenresRev,
                datasets: [{
                    label: 'Avg Revenue ($)',
                    data: sortedGenresRev.map(g => data.genre_revenues[g]),
                    backgroundColor: gradientBar,
                    borderColor: '#00f2fe',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                }
            }
        });

        // 2. Genre Popularity (Doughnut Chart)
        const ctxCount = document.getElementById('genreCountChart').getContext('2d');
        const sortedGenresCount = Object.keys(data.genre_counts).sort((a,b) => data.genre_counts[b] - data.genre_counts[a]).slice(0, 8);
        
        new Chart(ctxCount, {
            type: 'doughnut',
            data: {
                labels: sortedGenresCount,
                datasets: [{
                    data: sortedGenresCount.map(g => data.genre_counts[g]),
                    backgroundColor: [
                        '#00f2fe', '#4facfe', '#00ff87', '#ff0844', 
                        '#f59e0b', '#06b6d4', '#ec4899', '#6366f1'
                    ],
                    borderWidth: 2,
                    borderColor: '#050b14',
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { position: 'right', labels: { padding: 20 } }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutBounce'
                }
            }
        });

        // 3. Budget vs Revenue (Scatter Chart)
        if (data.budget_revenue && data.budget_revenue.length > 0) {
            const ctxScatter = document.getElementById('budgetRevenueChart').getContext('2d');
            new Chart(ctxScatter, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Movies',
                        data: data.budget_revenue,
                        backgroundColor: 'rgba(0, 255, 135, 0.6)',
                        borderColor: '#00ff87',
                        borderWidth: 1,
                        pointRadius: 6,
                        pointHoverRadius: 10,
                        pointHoverBackgroundColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { 
                            title: { display: true, text: 'Budget ($)', color: '#fff' },
                            type: 'linear',
                            position: 'bottom'
                        },
                        y: {
                            title: { display: true, text: 'Revenue ($)', color: '#fff' }
                        }
                    },
                    plugins: { legend: { display: false } },
                    animation: {
                        duration: 2000
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}
