(function() {
    'use strict';

    const CONFIG = {
        GAS_URL: 'https://script.google.com/macros/s/AKfycbyyldMA9zOeIjYHJR9FaoIPEonXoz8uiMjbNzP7JOtSYwbLexoLuuhpefSYLV6WwzMb-Q/exec',
        GOOGLE_FORM_URL: 'https://docs.google.com/forms/d/YOUR_GOOGLE_FORM_ID/formResponse',
        WhatsApp: 'https://wa.me/918010473982',
        BATCH_DELAY: 2000,
        SCROLL_THROTTLE: 200,
        CACHE_EXPIRY_DAYS: 30,
        FETCH_TIMEOUT: 8000,
        MAX_RETRIES: 2
    };

    const Tracker = {
        sessionId: null,
        sessionStart: null,
        clicksBeforeConversion: 0,
        scrollDepthReached: 0,
        formsOpened: 0,
        formsAbandoned: 0,
        formsSubmitted: 0,
        whatsappClicks: 0,
        callClicks: 0,
        pageViews: 0,
        eventQueue: [],
        lastScrollTime: 0,
        cachedData: null,
        cachedLocation: null,
        isSubmitting: false,
        hasSubmittedThisSession: false,
        maxQueueSize: 50,

        init() {
            try {
                this.sessionId = this.generateSessionId();
                this.sessionStart = Date.now();
                this.loadCachedData();
                this.checkConversionStatus();
                
                // Track visitor with error handling
                setTimeout(() => { try { this.trackVisitor(); } catch(e) { console.log('Visitor track error'); } }, 100);
                
                this.trackUser();
                this.setupEventListeners();
                this.prefillForms();
                this.setupFloorPlanTracking();
                this.setupNavigationTracking();
                this.setupExitIntentPopup();
                this.initReveals();
                this.initCounters();
                this.initTabs();
                this.initStickyHeader();
                this.initMobileNav();
                
                window.addEventListener('beforeunload', () => { try { this.saveSession(); } catch(e) {} });
                window.addEventListener('pagehide', () => { try { if (this.eventQueue.length > 0) this.batchTrack(true); } catch(e) {} });
            } catch (err) {
                console.log('Tracker init error, falling back to basic tracking');
            }
        },

        generateSessionId() {
            const existing = sessionStorage.getItem('villagio_session_id');
            if (existing) return existing;
            const newId = 's_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            sessionStorage.setItem('villagio_session_id', newId);
            return newId;
        },

        getDeviceInfo() {
            const ua = navigator.userAgent;
            const isMobile = /mobile|android|iphone|ipad|tablet/i.test(ua);
            const isAndroid = /android/i.test(ua);
            const isIOS = /iphone|ipad/i.test(ua);
            const os = isAndroid ? 'Android' : isIOS ? 'iOS' : 'Windows/Mac/Linux';
            return { isMobile, os, deviceType: isMobile ? 'Mobile' : 'Desktop', browser: this.getBrowser() };
        },

        getBrowser() {
            const ua = navigator.userAgent;
            if (ua.includes('Firefox')) return 'Firefox';
            if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
            if (ua.includes('Chrome')) return 'Chrome';
            if (ua.includes('Edge')) return 'Edge';
            return 'Other';
        },

        async getLocation() {
            if (this.cachedLocation) return this.cachedLocation;
            try {
                const response = await fetch('https://ipapi.co/json/', { 
                    mode: 'cors',
                    cache: 'force-cache'
                });
                const data = await response.json();
                this.cachedLocation = { 
                    city: data.city || '', 
                    location: data.region || '', 
                    timezone: data.timezone || '',
                    country: data.country || '',
                    ip: data.ip || '',
                    isp: data.org || data.connection.isp || '',
                    pincode: data.postal || data.zip || ''
                };
                return this.cachedLocation;
            } catch {
                this.cachedLocation = { city: '', location: '', timezone: 'Asia/Kolkata', country: 'India', ip: '', isp: '', pincode: '' };
                return this.cachedLocation;
            }
        },

        loadCachedData() {
            try {
                const cached = localStorage.getItem('villagio_contact');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const savedAt = parsed.savedAt || 0;
                    const daysSinceSave = (Date.now() - savedAt) / (1000 * 60 * 60 * 24);
                    if (daysSinceSave < CONFIG.CACHE_EXPIRY_DAYS) {
                        this.cachedData = parsed;
                    } else {
                        localStorage.removeItem('villagio_contact');
                    }
                }
                
                const existingSession = sessionStorage.getItem('villagio_session');
                if (existingSession) {
                    const session = JSON.parse(existingSession);
                    this.clicksBeforeConversion = session.clicks || 0;
                }
            } catch {}
        },

        saveContact(name, phone, email) {
            try {
                localStorage.setItem('villagio_contact', JSON.stringify({ 
                    name, phone, email, 
                    savedAt: Date.now() 
                }));
            } catch {}
        },

        checkConversionStatus() {
            const status = sessionStorage.getItem('villagio_converted');
            this.hasSubmittedThisSession = status === 'true';
        },

        prefillForms() {
            if (!this.cachedData) return;
            document.querySelectorAll('.lead-form').forEach(form => {
                const nameField = form.querySelector('input[name="name"]');
                const phoneField = form.querySelector('input[name="phone"]');
                const emailField = form.querySelector('input[name="email"]');
                if (nameField && this.cachedData.name) nameField.value = this.cachedData.name;
                if (phoneField && this.cachedData.phone) phoneField.value = this.cachedData.phone;
                if (emailField && this.cachedData.email) emailField.value = this.cachedData.email;
            });
        },

        async trackBehavior(eventType, eventLabel, sectionName = '') {
            if (eventType === 'form_submit') return;
            
            const timeOnSite = Math.floor((Date.now() - this.sessionStart) / 1000);
            const location = await this.getLocation();
            
            const eventData = {
                action: 'trackBehavior',
                data: {
                    session_id: this.sessionId,
                    event_type: eventType,
                    event_label: eventLabel,
                    page_url: window.location.href,
                    section_name: sectionName,
                    scroll_depth: this.scrollDepthReached,
                    time_on_site: timeOnSite,
                    ...this.getDeviceInfo(),
                    ...location
                }
            };

            if (CONFIG.GAS_URL.startsWith('https://')) {
                this.eventQueue.push(eventData);
                this.processEventQueue();
            }
        },

        async trackLeadSubmission(data) {
            const timeOnSite = Math.floor((Date.now() - this.sessionStart) / 1000);
            const location = await this.getLocation();
            
            // Combine country code with phone number
            const countryCode = data.country_code || '+91';
            const phoneNumber = data.phone || '';
            const fullPhone = countryCode + phoneNumber.replace(/^\+/, '');
            
            const leadData = {
                action: 'submitLead',
                data: {
                    name: data.name,
                    phone: fullPhone,
                    country_code: countryCode,
                    email: data.email,
                    looking_for: data.looking_for,
                    source_form: data.source_form,
                    time_on_site: timeOnSite,
                    clicks_before_conversion: this.clicksBeforeConversion,
                    session_id: this.sessionId,
                    utm_source: data.utm_source || '',
                    utm_medium: data.utm_medium || '',
                    utm_campaign: data.utm_campaign || '',
                    utm_content: data.utm_content || '',
                    device_type: this.getDeviceInfo().deviceType,
                    os: this.getDeviceInfo().os,
                    browser: this.getDeviceInfo().browser,
                    city: location.city,
                    location: location.location,
                    timezone: location.timezone
                }
            };

            console.log('=== LEAD SUBMISSION ===');
            console.log('URL:', CONFIG.GAS_URL);
            console.log('Data:', JSON.stringify(leadData, null, 2));

            // Send to GAS with no-cors (silent success)
            fetch(CONFIG.GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadData)
            }).then(() => {
                console.log('Lead sent to GAS');
            }).catch(err => {
                console.log('GAS failed, storing locally');
                // Fallback: store in localStorage
                const pending = JSON.parse(localStorage.getItem('villagio_pending_leads') || '[]');
                pending.push({ ...leadData, timestamp: new Date().toISOString() });
                localStorage.setItem('villagio_pending_leads', JSON.stringify(pending));
            });

            this.hasSubmittedThisSession = true;
            sessionStorage.setItem('villagio_converted', 'true');
            sessionStorage.setItem('villagio_session', JSON.stringify({ clicks: 0, converted: true }));
            return true;
        },

        sendWithTimeout(url, options, retries = CONFIG.MAX_RETRIES) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (retries > 0) {
                        this.sendWithTimeout(url, options, retries - 1).then(resolve).catch(reject);
                    } else {
                        reject(new Error('Request timeout'));
                    }
                }, CONFIG.FETCH_TIMEOUT);
                
                fetch(url, options).then(response => {
                    clearTimeout(timeout);
                    response.text().then(resolve).catch(reject);
                }).catch(err => {
                    clearTimeout(timeout);
                    if (retries > 0) {
                        this.sendWithTimeout(url, options, retries - 1).then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                });
            });
        },

        batchTrack(isExit = false) {
            if (this.eventQueue.length === 0) return;
            const batch = [...this.eventQueue];
            this.eventQueue = [];

            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batch }),
                keepalive: isExit
            };

            if (isExit) {
                navigator.sendBeacon(CONFIG.GAS_URL, JSON.stringify({ batch: batch }));
            } else {
                fetch(CONFIG.GAS_URL, options).catch(() => {
                    this.eventQueue = [...this.eventQueue, ...batch];
                });
            }
        },

        processEventQueue() {
            if (this.batchTimeout) clearTimeout(this.batchTimeout);
            this.batchTimeout = setTimeout(() => this.batchTrack(), CONFIG.BATCH_DELAY);
        },

        async saveSession() {
            const duration = Math.floor((Date.now() - this.sessionStart) / 1000);
            const location = await this.getLocation();
            
            const sessionData = {
                action: 'saveSession',
                data: {
                    session_id: this.sessionId,
                    start_time: new Date(this.sessionStart).toISOString(),
                    end_time: new Date().toISOString(),
                    duration: duration,
                    page_views: this.pageViews,
                    scroll_depth_reached: this.scrollDepthReached,
                    forms_opened: this.formsOpened,
                    forms_abandoned: this.formsAbandoned,
                    forms_submitted: this.formsSubmitted,
                    whatsapp_clicks: this.whatsappClicks,
                    call_clicks: this.callClicks,
                    ...this.getDeviceInfo(),
                    ...location
                }
            };

            if (CONFIG.GAS_URL.startsWith('https://')) {
                navigator.sendBeacon(CONFIG.GAS_URL, JSON.stringify(sessionData));
            }
        },

        setupEventListeners() {
            document.addEventListener('click', (e) => {
                if (this.hasSubmittedThisSession) return;
                const target = e.target;
                if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
                
                this.clicksBeforeConversion++;
                sessionStorage.setItem('villagio_session', JSON.stringify({ clicks: this.clicksBeforeConversion }));
            }, true);

            let scrollRAF = null;
            window.addEventListener('scroll', () => {
                if (scrollRAF) return;
                scrollRAF = requestAnimationFrame(() => {
                    scrollRAF = null;
                    this.handleScroll();
                });
            }, { passive: true });
        },

        handleScroll() {
            const now = Date.now();
            if (now - this.lastScrollTime < CONFIG.SCROLL_THROTTLE) return;
            this.lastScrollTime = now;
            
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = Math.min(100, Math.floor((window.scrollY / docHeight) * 100));
            
            [25, 50, 75, 100].forEach(milestone => {
                if (scrollPercent >= milestone && this.scrollDepthReached < milestone) {
                    this.scrollDepthReached = milestone;
                    this.trackBehavior('scroll_milestone', `${milestone}%`);
                }
            });
        },

        setupFloorPlanTracking() {
            const floorPlanSection = document.querySelector('.floorplan-section');
            if (!floorPlanSection) return;

            this.trackBehavior('floorplan_view', 'Section Viewed');

            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const floor = btn.textContent;
                    this.trackBehavior('floorplan_open', floor);
                });
            });
        },

        setupNavigationTracking() {
            document.querySelectorAll('a[href*="maps.google"]').forEach(link => {
                link.addEventListener('click', () => {
                    this.trackBehavior('google_maps_click', 'CTA Click');
                });
            });

            document.querySelectorAll('.floating-whatsapp a, a[href*="wa.me"]').forEach(link => {
                link.addEventListener('click', () => {
                    this.whatsappClicks++;
                    this.trackBehavior('whatsapp_click', 'Floating Button');
                });
            });

            document.querySelectorAll('a[href^="tel:"]').forEach(link => {
                link.addEventListener('click', () => {
                    this.callClicks++;
                    this.trackBehavior('call_click', 'Phone Link');
                });
            });
        },

        setupExitIntentPopup() {
            const popup = document.getElementById('exitPopup');
            const exitForm = document.getElementById('exitForm');
            if (!popup) return;

            let popupShown = false;
            let formFocused = false;

            const showPopup = () => {
                if (popupShown || sessionStorage.getItem('exitPopupShown') === 'true') return;
                if (this.hasSubmittedThisSession) return;
                
                popup.classList.add('active');
                popupShown = true;
                this.formsOpened++;
                this.trackBehavior('popup_view', 'Exit Intent');
                sessionStorage.setItem('exitPopupShown', 'true');
            };

            const hidePopup = () => {
                popup.classList.remove('active');
                this.trackBehavior('popup_close', 'Exit Intent');
            };

            document.addEventListener('mouseout', (e) => {
                if (e.clientY <= 0 && !popupShown && !this.hasSubmittedThisSession) {
                    showPopup();
                }
            });

            document.getElementById('popupClose')?.addEventListener('click', hidePopup);
            popup.addEventListener('click', (e) => { if (e.target === popup) hidePopup(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popup.classList.contains('active')) hidePopup(); });

            if (exitForm) {
                const formFields = exitForm.querySelectorAll('input, select');
                
                exitForm.addEventListener('focus', () => {
                    if (!formFocused) {
                        this.formsOpened++;
                        formFocused = true;
                    }
                }, true);

                formFields.forEach(field => {
                    field.addEventListener('blur', () => {
                        if (!field.value.trim() && !this.hasSubmittedThisSession) {
                            field.closest('.form-group')?.classList.add('touched');
                        }
                    });
                });

                exitForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.validateAndSubmit(exitForm);
                });
            }
        },

        validateAndSubmit(form) {
            if (this.isSubmitting) return;
            if (this.hasSubmittedThisSession) {
                alert('You have already submitted an inquiry.');
                return;
            }

            const honeypot = form.querySelector('input[name="website_url"]');
            if (honeypot && honeypot.value) {
                console.log('Bot submission blocked');
                form.reset();
                return;
            }

            let isValid = true;
            const firstError = form.querySelector('.form-group.error input, .form-group.error select');
            form.querySelectorAll('input[required], select[required]').forEach(field => {
                const formGroup = field.closest('.form-group');
                if (!formGroup) return;
                formGroup.classList.remove('error');
                
                if (!field.value.trim()) {
                    formGroup.classList.add('error');
                    isValid = false;
                } else if (field.type === 'email') {
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(field.value)) {
                        formGroup.classList.add('error');
                        isValid = false;
                    }
                } else if (field.type === 'tel' || field.classList.contains('phone-field')) {
                    const phone = field.value.replace(/\D/g, '');
                    const countrySelect = form.querySelector('select[name="country_code"]');
                    const countryCode = countrySelect ? countrySelect.value : '+91';
                    
                    let minLen = 10;
                    if (countryCode === '+91') minLen = 10;
                    else if (countryCode === '+1') minLen = 10;
                    else if (countryCode === '+44') minLen = 10;
                    else if (countryCode === '+61') minLen = 9;
                    else if (countryCode === '+971') minLen = 9;
                    else minLen = 10;
                    
                    if (phone.length < minLen) {
                        formGroup.classList.add('error');
                        isValid = false;
                    }
                }
            });

            if (!isValid) {
                if (firstError) firstError.focus();
                return;
            }

            this.isSubmitting = true;
            const btn = form.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.textContent = 'Submitting...';
            btn.disabled = true;

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            this.trackLeadSubmission(data).then(success => {
                this.saveContact(data.name, data.phone, data.email);
                this.formsSubmitted++;
                this.trackBehavior('form_submit', form.dataset.formId || 'unknown');
                
                form.reset();
                form.querySelectorAll('.form-group.error, .form-group.touched').forEach(el => {
                    el.classList.remove('error', 'touched');
                });

                if (form.dataset.redirect === 'whatsapp' && success !== false) {
                    const name = data.name || 'there';
                    const interest = data.looking_for || 'Not specified';
                    const message = `Hello, I am interested in Villagio.\nName: ${name}\nPhone: ${data.phone}\nInterest: ${interest}`;
                    const whatsappUrl = `${CONFIG.WhatsApp}?text=${encodeURIComponent(message)}`;
                    setTimeout(() => window.open(whatsappUrl, '_blank'), 500);
                }
            }).catch(() => {
                btn.textContent = 'Error - Try Again';
            }).finally(() => {
                this.isSubmitting = false;
                btn.textContent = origText;
                btn.disabled = false;
            });
        },

        initReveals() {
            const reveals = document.querySelectorAll('.reveal');
            const revealed = new Set();
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting && !revealed.has(e.target)) {
                        revealed.add(e.target);
                        e.target.classList.add('revealed');
                        observer.unobserve(e.target);
                    }
                });
            }, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });
            reveals.forEach(el => observer.observe(el));
        },

        initCounters() {
            const counters = document.querySelectorAll('.dev-number[data-target]');
            const counted = new Set();
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting && !counted.has(e.target)) {
                        counted.add(e.target);
                        const el = e.target;
                        const target = parseInt(el.dataset.target);
                        let current = 0;
                        const step = target / 50;
                        const timer = setInterval(() => {
                            current += step;
                            if (current >= target) { current = target; clearInterval(timer); }
                            el.textContent = Math.floor(current) + (target >= 100 ? '+' : '');
                        }, 30);
                        observer.unobserve(el);
                    }
                });
            }, { threshold: 0.5 });
            counters.forEach(el => observer.observe(el));
        },

        initTabs() {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.floorplan-panel').forEach(p => p.classList.remove('active'));
                    this.classList.add('active');
                    document.getElementById(this.dataset.tab).classList.add('active');
                });
            });
        },

        initStickyHeader() {
            const header = document.querySelector('.header');
            window.addEventListener('scroll', () => {
                header?.classList.toggle('scrolled', window.scrollY > 60);
                const sticky = document.getElementById('stickyInquiry');
                if (sticky) {
                    const hero = document.getElementById('hero');
                    const heroBottom = hero?.offsetTop + hero?.offsetHeight;
                    sticky.classList.toggle('hidden', window.scrollY > heroBottom);
                }
            }, { passive: true });
        },

        initMobileNav() {
            const toggle = document.querySelector('.nav-toggle');
            const navRight = document.querySelector('.nav-right');
            toggle?.addEventListener('click', () => {
                toggle.classList.toggle('active');
                navRight?.classList.toggle('mobile-open');
            });

            document.querySelectorAll('a[href^="#"]').forEach(a => {
                a.addEventListener('click', () => {
                    toggle?.classList.remove('active');
                    navRight?.classList.remove('mobile-open');
                });
            });
        },

        trackVisitor() {
            this.pageViews++;
            
            // Get location - only send essential data
            this.getLocation().then(location => {
                const visitorData = {
                    action: 'trackVisitor',
                    data: {
                        session_id: this.sessionId,
                        page_url: window.location.href,
                        referrer: document.referrer || 'Direct',
                        entry_time: new Date(this.sessionStart).toISOString(),
                        bounced: this.formsOpened === 0 && this.formsSubmitted === 0,
                        ip: location.ip || '',
                        isp: location.isp || '',
                        city: location.city || '',
                        pincode: location.pincode || '',
                        region: location.location || '',
                        country: location.country || 'India',
                        timezone: location.timezone || 'Asia/Kolkata'
                    }
                };
                
                // Send visitor data with no-cors (fire and forget)
                fetch(CONFIG.GAS_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(visitorData)
                }).catch(() => {});
            });
            
            // Track form link clicks
            const heroLink = document.querySelector('a[href="#inquiry"]');
            if (heroLink && !heroLink._tracked) {
                heroLink._tracked = true;
                heroLink.addEventListener('click', () => {
                    if (!this.hasSubmittedThisSession) {
                        this.formsOpened++;
                        this.trackBehavior('form_open', 'Hero Form');
                    }
                });
            }
        },

        trackUser() {
            this.pageViews++;
            
            const heroLink = document.querySelector('a[href="#inquiry"]');
            if (heroLink && !heroLink._tracked) {
                heroLink._tracked = true;
                heroLink.addEventListener('click', () => {
                    if (!this.hasSubmittedThisSession) {
                        this.formsOpened++;
                        this.trackBehavior('form_open', 'Hero Form');
                    }
                });
            }
        }
    };

    const leadForms = document.querySelectorAll('.lead-form:not([data-form-id])');
    leadForms.forEach(form => {
        if (!form.dataset.formId) form.dataset.formId = 'hero';
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            Tracker.validateAndSubmit(form);
        });
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Tracker.init());
    } else {
        Tracker.init();
    }
})();