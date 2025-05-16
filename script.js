// script.js - Main JavaScript File (النسخة الكاملة والصحيحة والمُعدلة تمامًا)

document.addEventListener('DOMContentLoaded', () => {
    // --- 0. STATE & CONFIGURATION ---
    const appState = {
        currentView: 'units-list', // 'units-list', 'lessons-list', 'lesson-view'
        currentUnitId: null,
        currentUnitInfo: null, // Will store the full info for the current unit, including 'lessonFiles'
        currentLessonFileBaseName: null, // e.g., "lesson_01" (without .json)
        currentLessonInfo: null, // Will store {id, title_ar, filePath (from allLessonsInCurrentUnit)} when navigating to lesson view
        allUnitsInfo: [], // Stores {id, title_ar, ..., folderName, lessonFiles: [...]}
        allLessonsInCurrentUnit: [], // Stores {id, fileBaseName, title_ar,..., filePath} for current unit
        dataBasePath: './data/',
    };

    // --- 1. DOM ELEMENT SELECTORS ---
    const mainContentDisplay = document.getElementById('dynamic-content-display');
    const breadcrumbNav = document.getElementById('breadcrumb-navigation');
    const homeLink = document.getElementById('home-link');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const currentYearSpan = document.getElementById('current-year');

    // --- 2. UTILITY FUNCTIONS ---
    function showLoading(show) {
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'block' : 'none';
        }
    }

    function sanitizeTextAndStructure(htmlString) {
        if (typeof htmlString !== 'string') return '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const allowedTags = ['span', 'br', 'p', 'strong', 'em', 'ul', 'li', 'h4', 'h5', 'i', 'div'];
        const allowedSpanClasses = ['foreign-phrase-in-rtl'];

        function sanitizeNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(node.textContent);
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                if (allowedTags.includes(tagName)) {
                    const newNode = document.createElement(tagName);
                    if (tagName === 'span') {
                        for (const cls of node.classList) {
                            if (allowedSpanClasses.includes(cls)) {
                                newNode.classList.add(cls);
                            }
                        }
                    } else if (node.hasAttribute('class') && tagName !== 'script') {
                        newNode.className = node.className;
                    }
                    if (node.hasAttribute('data-lang-dir')) {
                        newNode.setAttribute('data-lang-dir', node.getAttribute('data-lang-dir'));
                    }
                    if (tagName !== 'br' && tagName !== 'img') {
                        for (const child of node.childNodes) {
                            newNode.appendChild(sanitizeNode(child));
                        }
                    }
                    return newNode;
                } else {
                    const fragment = document.createDocumentFragment();
                    for (const child of node.childNodes) {
                        fragment.appendChild(sanitizeNode(child));
                    }
                    return fragment;
                }
            }
            return document.createDocumentFragment();
        }
        const fragment = document.createDocumentFragment();
        for (const child of doc.body.childNodes) {
            fragment.appendChild(sanitizeNode(child));
        }
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
        return tempDiv.innerHTML;
    }

    async function fetchData(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`File not found (404): ${filePath}`);
                    return null;
                }
                throw new Error(`Network error (${response.status}) fetching ${filePath}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Fetch error for " + filePath + ":", error);
            return 'FETCH_ERROR';
        }
    }

    // --- 3. RENDERING FUNCTIONS ---
    function renderBreadcrumbs() {
        let html = `<a href="#" data-view="units-list" class="crumb-link">الرئيسية (الوحدات)</a>`;
        if (appState.currentView === 'lessons-list' && appState.currentUnitInfo) {
            html += ` > <span class="current-crumb">${sanitizeTextAndStructure(appState.currentUnitInfo.title_ar)} (قائمة الدروس)</span>`;
        } else if (appState.currentView === 'lesson-view' && appState.currentUnitInfo && appState.currentLessonInfo) {
            html += ` > <a href="#" data-view="lessons-list" data-unit-id="${appState.currentUnitId}" class="crumb-link">${sanitizeTextAndStructure(appState.currentUnitInfo.title_ar)}</a>`;
            html += ` > <span class="current-crumb">${sanitizeTextAndStructure(appState.currentLessonInfo.title_ar)}</span>`;
        }
        breadcrumbNav.innerHTML = html;
        breadcrumbNav.querySelectorAll('.crumb-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetView = e.target.dataset.view;
                const targetUnitId = e.target.dataset.unitId;
                if (targetView === 'units-list') {
                    navigateToUnitsList();
                } else if (targetView === 'lessons-list' && targetUnitId) {
                    const unitToNavigate = appState.allUnitsInfo.find(u => u.id === targetUnitId);
                    if (unitToNavigate) {
                        appState.currentUnitId = targetUnitId;
                        appState.currentUnitInfo = unitToNavigate;
                        navigateToLessonsList();
                    }
                }
            });
        });
    }

    function renderUnitsList(units) {
        showLoading(false); mainContentDisplay.innerHTML = '';
        if (!units || units.length === 0) { mainContentDisplay.innerHTML = `<p class="info-message">لا توجد وحدات متاحة حالياً. الرجاء التأكد من وجود ملفات <code>unit-info.json</code> صالحة وتحتوي على مصفوفة <code>lessonFiles</code> صحيحة.</p>`; return; }
        let html = `<h2 class="page-section-title"><i class="icon fa-solid fa-cubes"></i> الوحدات التعليمية</h2><div class="cards-grid">`;
        units.forEach(unit => { const themeClass = unit.theme_color_class || 'theme-default'; const iconClass = unit.icon_fa_class || 'fa-solid fa-book-open-reader'; html += `<div class="card-item ${themeClass}" data-unit-id="${unit.id}" aria-label="افتح وحدة ${sanitizeTextAndStructure(unit.title_ar)}"><div class="card-icon-area"><i class="icon ${iconClass}"></i></div><h3 class="card-title">${sanitizeTextAndStructure(unit.title_ar)}</h3><p class="card-subtitle-langs">${sanitizeTextAndStructure(unit.title_en)} / ${sanitizeTextAndStructure(unit.title_tr)}</p><p class="card-description">${sanitizeTextAndStructure(unit.description_ar)}</p><div class="card-footer-info"><i class="icon fa-solid fa-layer-group"></i><span>${(unit.lessonFiles && unit.lessonFiles.length) || unit.lessons_count || 0} دروس</span></div></div>`; });
        html += `</div>`; mainContentDisplay.innerHTML = html;
        mainContentDisplay.querySelectorAll('.card-item[data-unit-id]').forEach(card => {
            card.addEventListener('click', () => {
                const selectedUnitId = card.dataset.unitId;
                const selectedUnitInfo = appState.allUnitsInfo.find(u => u.id === selectedUnitId);
                if (selectedUnitInfo) { appState.currentUnitId = selectedUnitId; appState.currentUnitInfo = selectedUnitInfo; navigateToLessonsList(); }
                else { console.error("Could not find unit info for ID:", selectedUnitId); displayGlobalErrorMessage("خطأ: لم يتم العثور على معلومات الوحدة المحددة."); }
            });
        });
    }

    function renderLessonsList(lessons, unitTitleAr) {
        showLoading(false); mainContentDisplay.innerHTML = '';
        if (!appState.currentUnitInfo) { displayGlobalErrorMessage("خطأ: معلومات الوحدة الحالية غير متوفرة لعرض الدروس."); return; }
        if (!lessons || lessons.length === 0) { mainContentDisplay.innerHTML = `<h2 class="page-section-title"><i class="icon ${appState.currentUnitInfo.icon_fa_class || 'fa-solid fa-book-open-reader'}"></i> دروس وحدة: ${sanitizeTextAndStructure(unitTitleAr)}</h2><p class="info-message">لا توجد دروس متاحة لهذه الوحدة حاليًا.</p>`; return; }
        let html = `<h2 class="page-section-title"><i class="icon ${appState.currentUnitInfo.icon_fa_class || 'fa-solid fa-book-open-reader'}"></i> دروس وحدة: ${sanitizeTextAndStructure(unitTitleAr)}</h2><div class="cards-grid lessons-list-specific">`;
        lessons.forEach(lesson => { const iconClass = lesson.icon_fa_class || 'fa-solid fa-chalkboard-user'; const themeClass = lesson.theme_color_class || 'theme-default'; html += `<div class="card-item lesson-card-list-item ${themeClass}" data-lesson-filepath="${lesson.filePath}" data-lesson-id="${lesson.id}" data-lesson-filebasename="${lesson.fileBaseName}" aria-label="ابدأ درس ${sanitizeTextAndStructure(lesson.title_ar)}"><div class="card-icon-area"><i class="icon ${iconClass}"></i></div><h3 class="card-title">${sanitizeTextAndStructure(lesson.title_ar)}</h3> <p class="card-subtitle-langs">${sanitizeTextAndStructure(lesson.title_en)} / ${sanitizeTextAndStructure(lesson.title_tr)}</p><p class="card-description" style="font-style: italic; font-size: 0.85em;">${sanitizeTextAndStructure(lesson.objective_ar)}</p>${lesson.phrases_count?`<div class="card-footer-info"><i class="icon fa-solid fa-list-ul"></i><span>${lesson.phrases_count} عبارات</span></div>`:''}</div>`; });
        html += `</div>`; mainContentDisplay.innerHTML = html;
        mainContentDisplay.querySelectorAll('.card-item[data-lesson-filepath]').forEach(card => {
            card.addEventListener('click', () => {
                appState.currentLessonId = card.dataset.lessonId;
                appState.currentLessonFileBaseName = card.dataset.lessonFilebasename;
                const lessonInfoForState = appState.allLessonsInCurrentUnit.find(l => l.id === appState.currentLessonId);
                if (lessonInfoForState) appState.currentLessonInfo = lessonInfoForState;
                navigateToLessonView(card.dataset.lessonFilepath);
            });
        });
    }

    function renderLessonView(lessonData) {
        showLoading(false); mainContentDisplay.innerHTML = '';
        if (!lessonData || lessonData === 'FETCH_ERROR') { displayGlobalErrorMessage("خطأ في تحميل محتوى الدرس."); return; }
        const isScenarioLesson = lessonData.scenario && lessonData.phrases_analysis;
        let html = `<div class="lesson-header-view"><i class="icon ${lessonData.icon_fa_class||'fa-solid fa-person-chalkboard'}"></i><h1>${sanitizeTextAndStructure(lessonData.title_ar)}</h1><p class="lesson-view-subtitle" data-lang-dir="ltr">${sanitizeTextAndStructure(lessonData.title_en)} / ${sanitizeTextAndStructure(lessonData.title_tr)}</p><p class="lesson-view-objective" data-lang-dir="rtl">${sanitizeTextAndStructure(lessonData.objective_ar)}</p></div>`;

        if (isScenarioLesson) {
            html += `<div class="full-dialogue-section">`;
            const charactersMap = new Map(lessonData.scenario.characters.map(char => [char.id, char]));
            // Arabic Dialogue
            html += `<div class="dialogue-language-block" data-lang-dir="rtl"><h3 class="dialogue-lang-title"><span class="flag-icon">🇸🇦</span> الحوار بالعربية</h3><ul class="dialogue-lines-list">`;
            lessonData.scenario.dialogue_lines.forEach(line => { const character = charactersMap.get(line.character_id); const charName = character ? sanitizeTextAndStructure(character.name_ar) : 'متحدث'; const charColorClass = character ? `${character.id}-color` : ''; html += `<li class="dialogue-line-item"><strong class="line-character-name ${charColorClass}">${charName}:</strong><span class="line-text-content">${sanitizeTextAndStructure(line.line_ar)}</span><button class="line-speak-btn" data-text="${sanitizeTextAndStructure(line.line_ar)}" data-lang="ar-SA" title="نطق"><i class="fa-solid fa-volume-high"></i></button></li>`; });
            html += `</ul></div>`;
            // English Dialogue
            html += `<div class="dialogue-language-block" data-lang-dir="ltr"><h3 class="dialogue-lang-title"><span class="flag-icon flag-icon-gb"></span>Dialogue in English</h3><ul class="dialogue-lines-list">`;
            lessonData.scenario.dialogue_lines.forEach(line => { const character = charactersMap.get(line.character_id); const charName = character ? sanitizeTextAndStructure(character.name_en) : 'Speaker'; const charColorClass = character ? `${character.id}-color` : ''; html += `<li class="dialogue-line-item"><strong class="line-character-name ${charColorClass}">${charName}:</strong><span class="line-text-content">${sanitizeTextAndStructure(line.line_en)}</span><button class="line-speak-btn" data-text="${sanitizeTextAndStructure(line.line_en)}" data-lang="en-US" title="Speak"><i class="fa-solid fa-volume-high"></i></button></li>`; });
            html += `</ul></div>`;
            // Turkish Dialogue
            html += `<div class="dialogue-language-block" data-lang-dir="ltr"><h3 class="dialogue-lang-title"><span class="flag-icon flag-icon-tr"></span>Türkçe Diyalog</h3><ul class="dialogue-lines-list">`;
            lessonData.scenario.dialogue_lines.forEach(line => { const character = charactersMap.get(line.character_id); const charNameTr = character ? sanitizeTextAndStructure(character.name_tr) : 'Konuşmacı'; const lineTrText = line.line_tr; const charColorClass = character ? `${character.id}-color` : ''; html += `<li class="dialogue-line-item"><strong class="line-character-name ${charColorClass}">${charNameTr}:</strong><span class="line-text-content">${sanitizeTextAndStructure(lineTrText)}</span><button class="line-speak-btn" data-text="${sanitizeTextAndStructure(lineTrText)}" data-lang="tr-TR" title="Seslendir"><i class="fa-solid fa-volume-high"></i></button></li>`; });
            html += `</ul></div>`; html += `</div>`;

            html += `<div class="phrases-analysis-container"><h2 class="analysis-title">تحليل العبارات الرئيسية</h2><div class="lesson-phrases-list">`;
            lessonData.phrases_analysis.forEach(phrase => { const arSpeakText = phrase.audio_ar_tts_key || phrase.ar_from_dialogue; const enSpeakText = phrase.audio_en_tts_key || phrase.en_from_dialogue; const trSpeakText = phrase.audio_tr_tts_key || phrase.tr_from_dialogue; html += `<div class="phrase-card-item" id="phrase-analysis-${sanitizeTextAndStructure(phrase.id)}"><p class="phrase-main-ar original-from-dialogue">من الحوار: <em>"${sanitizeTextAndStructure(phrase.ar_from_dialogue)}"</em></p><div class="phrase-focus-section"><p><strong><i class="fa-solid fa-bullseye"></i> التركيز الأساسي:</strong> ${sanitizeTextAndStructure(phrase.focus_ar)}</p></div><div class="phrase-actions"><button class="speak-btn speak-ar" data-text="${sanitizeTextAndStructure(arSpeakText)}" data-lang="ar-SA"><i class="fa-solid fa-volume-high"></i> العربية</button><button class="speak-btn speak-en" data-text="${sanitizeTextAndStructure(enSpeakText)}" data-lang="en-US"><i class="fa-solid fa-volume-high"></i> الإنجليزية</button><button class="speak-btn speak-tr" data-text="${sanitizeTextAndStructure(trSpeakText)}" data-lang="tr-TR"><i class="fa-solid fa-volume-high"></i> التركية</button></div><div class="phrase-translations-grid"><div class="translation-block lang-en"><p class="lang-label"><span class="flag-icon flag-icon-gb"></span>English Focus: ${sanitizeTextAndStructure(phrase.focus_en)}</p><p class="phrase-text">${sanitizeTextAndStructure(phrase.en_from_dialogue)}</p>${phrase.explanation_en ? `<p class="explanation-text" data-lang-dir="ltr">${sanitizeTextAndStructure(phrase.explanation_en)}</p>` : ''}${phrase.alternatives_en && phrase.alternatives_en.length > 0 ? `<p class="alternatives-text" data-lang-dir="ltr"><strong>Alternatives:</strong> ${phrase.alternatives_en.map(s => sanitizeTextAndStructure(s)).join(' / ')}</p>` : ''}</div><div class="translation-block lang-tr"><p class="lang-label"><span class="flag-icon flag-icon-tr"></span>Türkçe Odak: ${sanitizeTextAndStructure(phrase.focus_tr)}</p><p class="phrase-text">${sanitizeTextAndStructure(phrase.tr_from_dialogue)}</p>${phrase.explanation_tr ? `<p class="explanation-text" data-lang-dir="ltr">${sanitizeTextAndStructure(phrase.explanation_tr)}</p>` : ''}${phrase.alternatives_tr && phrase.alternatives_tr.length > 0 ? `<p class="alternatives-text" data-lang-dir="ltr"><strong>Alternatifler:</strong> ${phrase.alternatives_tr.map(s => sanitizeTextAndStructure(s)).join(' / ')}</p>` : ''}</div></div></div>`; });
            html += `</div></div>`;
        } else if (lessonData.phrases && lessonData.phrases.length > 0) {
            html += `<div class="lesson-phrases-list">`; let cat = null;
            lessonData.phrases.forEach(p => { if (p.category_ar && p.category_ar !== cat) { if (cat) html+=`</div>`; html+=`<div class="phrase-category-group"><h3 class="phrase-category-title">${sanitizeTextAndStructure(p.category_ar)}</h3>`; cat=p.category_ar; } const arSpeak = p.audio_ar_tts_key || p.ar; const enSpeak = p.audio_en_tts_key || p.en; const trSpeak = p.audio_tr_tts_key || p.tr; html += `<div class="phrase-card-item" id="phrase-${sanitizeTextAndStructure(p.id)}"><p class="phrase-main-ar">${sanitizeTextAndStructure(p.ar)}</p><div class="phrase-actions"><button class="speak-btn speak-ar" data-text="${sanitizeTextAndStructure(arSpeak)}" data-lang="ar-SA"><i class="fa-solid fa-volume-high"></i> العربية</button>${p.en?`<button class="speak-btn speak-en" data-text="${sanitizeTextAndStructure(enSpeak)}" data-lang="en-US"><i class="fa-solid fa-volume-high"></i> EN</button>`:''}${p.tr?`<button class="speak-btn speak-tr" data-text="${sanitizeTextAndStructure(trSpeak)}" data-lang="tr-TR"><i class="fa-solid fa-volume-high"></i> TR</button>`:''}</div><div class="phrase-translations-grid">${p.en?`<div class="translation-block lang-en"><p class="lang-label"><span class="flag-icon flag-icon-gb"></span>EN</p><p class="phrase-text">${sanitizeTextAndStructure(p.en)}</p></div>`:''}${p.tr?`<div class="translation-block lang-tr"><p class="lang-label"><span class="flag-icon flag-icon-tr"></span>TR</p><p class="phrase-text">${sanitizeTextAndStructure(p.tr)}</p></div>`:''}</div><div class="phrase-notes-examples">${p.en_note?`<div class="notes-block" data-lang-dir="ltr"><h4><i class="icon fa-solid fa-lightbulb"></i>Note (EN)</h4><p>${sanitizeTextAndStructure(p.en_note)}</p></div>`:''}${p.tr_note?`<div class="notes-block" data-lang-dir="ltr"><h4><i class="icon fa-solid fa-lightbulb"></i>Not (TR)</h4><p>${sanitizeTextAndStructure(p.tr_note)}</p></div>`:''}${p.example_en?`<div class="examples-block" data-lang-dir="ltr"><h4><i class="icon fa-solid fa-quote-left"></i>Ex (EN)</h4><p><em>${sanitizeTextAndStructure(p.example_en)}</em></p></div>`:''}${p.example_tr?`<div class="examples-block" data-lang-dir="ltr"><h4><i class="icon fa-solid fa-quote-left"></i>Örn (TR)</h4><p><em>${sanitizeTextAndStructure(p.example_tr)}</em></p></div>`:''}</div></div>`; }); if (cat) html+=`</div>`; html += `</div>`;
        } else { html += `<p class="info-message">لا يوجد محتوى تفصيلي لهذا الدرس حاليًا.</p>`; }

        if (appState.allLessonsInCurrentUnit && appState.allLessonsInCurrentUnit.length > 1) { const currentIdx = appState.allLessonsInCurrentUnit.findIndex(l => l.id === lessonData.id); html += `<div class="lesson-navigation">`; if (currentIdx > 0) { const prev = appState.allLessonsInCurrentUnit[currentIdx-1]; html+=`<button class="lesson-nav-btn prev" data-lesson-path="${prev.filePath}" data-lesson-id="${prev.id}"><i class="fa-solid fa-arrow-right"></i> السابق</button>`; } else { html+=`<button class="lesson-nav-btn prev disabled" disabled><i class="fa-solid fa-arrow-right"></i> السابق</button>`; } if (currentIdx < appState.allLessonsInCurrentUnit.length - 1) { const next = appState.allLessonsInCurrentUnit[currentIdx+1]; html+=`<button class="lesson-nav-btn next" data-lesson-path="${next.filePath}" data-lesson-id="${next.id}">التالي <i class="fa-solid fa-arrow-left"></i></button>`; } else { html+=`<button class="lesson-nav-btn next disabled" disabled>التالي <i class="fa-solid fa-arrow-left"></i></button>`; } html += `</div>`;}
        mainContentDisplay.innerHTML = html;
        mainContentDisplay.querySelectorAll('.speak-btn, .line-speak-btn').forEach(b => { b.addEventListener('click', function(){const txt=this.dataset.text; const lng=this.dataset.lang; if(typeof speakText==='function'){ const btn=this; window.speechSynthesis.cancel(); document.querySelectorAll('.speak-btn.speaking, .line-speak-btn.speaking').forEach(oBtn => oBtn.classList.remove('speaking')); btn.classList.add('speaking'); speakText(txt,lng,null,()=>btn.classList.remove('speaking'),(e)=>{btn.classList.remove('speaking');console.error("TTS Err",e); const errS=document.createElement('span');errS.textContent=' خطأ!'; errS.style.color='red'; errS.style.fontSize='0.7em'; btn.appendChild(errS); setTimeout(()=>errS.remove(),2000); });}});});
        mainContentDisplay.querySelectorAll('.lesson-nav-btn:not(.disabled)').forEach(b => { b.addEventListener('click', function(){ const p=this.dataset.lessonPath; appState.currentLessonId=this.dataset.lessonId; const li=appState.allLessonsInCurrentUnit.find(l=>l.id===appState.currentLessonId); if(li)appState.currentLessonInfo=li; navigateToLessonView(p);});});
        checkScreenSizeForTranslations();
    }

    // --- 4. NAVIGATION LOGIC ---
    async function navigateToUnitsList() { showLoading(true); mainContentDisplay.innerHTML = ''; if(loadingIndicator) mainContentDisplay.appendChild(loadingIndicator); appState.currentView = 'units-list'; appState.currentUnitId = null; appState.currentUnitInfo = null; appState.currentLessonId = null; appState.currentLessonFileBaseName = null; appState.currentLessonInfo = null; renderBreadcrumbs(); const unitFolders = ['unit_01_daily_scenarios_problem_solving','unit_02_daily_life_activities','unit_03_people_and_relationships','unit_04_navigating_and_exploring','unit_05_opinions_and_discussions','unit_06_advanced_communication_and_nuances']; const promises = unitFolders.map(async(f)=>{const i=await fetchData(`${appState.dataBasePath}${f}/unit-info.json`);return i?{...i,folderName:f}:null;}); appState.allUnitsInfo = (await Promise.all(promises)).filter(u => u && u.id && Array.isArray(u.lessonFiles) && u.lessonFiles.length > 0); renderUnitsList(appState.allUnitsInfo); }
    async function navigateToLessonsList() { if (!appState.currentUnitInfo || !Array.isArray(appState.currentUnitInfo.lessonFiles)) { displayGlobalErrorMessage("خطأ: معلومات الوحدة ناقصة."); renderBreadcrumbs(); return; } showLoading(true); mainContentDisplay.innerHTML = ''; if(loadingIndicator) mainContentDisplay.appendChild(loadingIndicator); appState.currentView = 'lessons-list'; appState.currentLessonId = null; appState.currentLessonFileBaseName = null; appState.currentLessonInfo = null; renderBreadcrumbs(); const unitFolderName = appState.currentUnitInfo.folderName; const lessonFileBaseNames = appState.currentUnitInfo.lessonFiles; appState.allLessonsInCurrentUnit = []; for (const fileBaseName of lessonFileBaseNames) { const lessonFilePath = `${appState.dataBasePath}${unitFolderName}/${fileBaseName}.json`; const lessonData = await fetchData(lessonFilePath); if (lessonData && lessonData.id) { appState.allLessonsInCurrentUnit.push({ id: lessonData.id, fileBaseName: fileBaseName, title_ar: lessonData.title_ar, title_en: lessonData.title_en, title_tr: lessonData.title_tr, objective_ar: lessonData.objective_ar, icon_fa_class: lessonData.icon_fa_class, phrases_count: (lessonData.phrases_analysis ? lessonData.phrases_analysis.length : (lessonData.phrases ? lessonData.phrases.length : 0)), filePath: lessonFilePath }); } else { console.warn(`ملف الدرس ${fileBaseName}.json مفقود/غير صالح.`); } } renderLessonsList(appState.allLessonsInCurrentUnit, appState.currentUnitInfo.title_ar); }
    async function navigateToLessonView(lessonFilePath) { showLoading(true); mainContentDisplay.innerHTML = ''; if(loadingIndicator) mainContentDisplay.appendChild(loadingIndicator); appState.currentView = 'lesson-view'; renderBreadcrumbs(); const lessonFullData = await fetchData(lessonFilePath); if (lessonFullData === 'FETCH_ERROR') { displayGlobalErrorMessage("خطأ تحميل الدرس."); return; } if (lessonFullData && lessonFullData.id) { appState.currentLessonId = lessonFullData.id; const fileBaseNameFromPath = lessonFilePath.split('/').pop().replace('.json',''); appState.currentLessonFileBaseName = fileBaseNameFromPath; let foundLesson = appState.allLessonsInCurrentUnit.find(l => l.id === lessonFullData.id || l.fileBaseName === fileBaseNameFromPath ); if (foundLesson) { appState.currentLessonInfo = foundLesson; } else { appState.currentLessonInfo = { id: lessonFullData.id, fileBaseName: fileBaseNameFromPath, title_ar: lessonFullData.title_ar, filePath: lessonFilePath }; console.warn("معلومات الدرس للتنقل لم تكن محملة مسبقًا.");} renderLessonView(lessonFullData); } else { displayGlobalErrorMessage("لم يتم العثور على محتوى الدرس."); } }

    // --- 5. EVENT LISTENERS & INITIALIZATION ---
    homeLink.addEventListener('click', (e) => { e.preventDefault(); navigateToUnitsList(); });
    function applyTheme(theme) { if (theme === 'dark') {document.body.classList.add('dark-theme');themeToggleButton.innerHTML = '<i class="fa-solid fa-sun"></i>';} else {document.body.classList.remove('dark-theme');themeToggleButton.innerHTML = '<i class="fa-solid fa-moon"></i>';}localStorage.setItem('lughatiTheme', theme);}
    themeToggleButton.addEventListener('click', () => {const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); });
    const savedTheme = localStorage.getItem('lughatiTheme'); if (savedTheme) { applyTheme(savedTheme); } else { applyTheme('light'); }
    if (currentYearSpan) { currentYearSpan.textContent = new Date().getFullYear(); }
    function checkScreenSizeForTranslations() {if (window.innerWidth > 768) {document.body.classList.add('large-screen');} else {document.body.classList.remove('large-screen');}}
    window.addEventListener('resize', checkScreenSizeForTranslations); checkScreenSizeForTranslations();
    window.speakText = function(text, lang, onStart, onEnd, onError) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const utt = new SpeechSynthesisUtterance(text); utt.lang = lang; utt.rate = 0.9; utt.pitch = 1; const voices = window.speechSynthesis.getVoices(); let selVoice = voices.find(v => v.lang === lang); if (!selVoice && lang.includes('-')) { const base = lang.split('-')[0]; selVoice = voices.find(v => v.lang.startsWith(base + "-")) || voices.find(v => v.lang === base); } if (!selVoice && lang === "ar-SA") { selVoice = voices.find(v => v.lang.startsWith("ar-") && v.name.toLowerCase().includes("female")) || voices.find(v => v.lang.startsWith("ar-"));} if (selVoice) utt.voice = selVoice; else console.warn(`No voice for ${lang}`); utt.onstart=onStart||(()=>{}); utt.onend=onEnd||(()=>{}); utt.onerror=onError||((ev)=>{console.error('TTS Err', ev);}); window.speechSynthesis.speak(utt); } else { console.error('TTS not supported.'); if(onError)onError({error:'unsupported'}); }};
    window.displayGlobalErrorMessage = function(message, details = '') { showLoading(false); mainContentDisplay.innerHTML = ''; const errDiv = document.createElement('div'); errDiv.className = 'error-message'; errDiv.innerHTML = `<p style="font-weight:bold;font-size:1.2em;">${sanitizeTextAndStructure(message)}</p>${details?`<p style="font-size:0.8em;margin-top:10px;">تفاصيل: ${sanitizeTextAndStructure(details)}</p>`:''}`; mainContentDisplay.appendChild(errDiv);};

    navigateToUnitsList();
});