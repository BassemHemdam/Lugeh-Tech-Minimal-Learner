// script.js - Main JavaScript File (إصلاح مشكلة عدم ظهور محتوى الدروس مع Hash Navigation)

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded - Script execution started.");
    // --- 0. STATE & CONFIGURATION ---
    const appState = {
        allUnitsInfo: [],         // سيخزن كل معلومات الوحدات (من unit-info.json) بعد جلبها
        currentUnitInfo: null,      // سيحتوي على كائن الوحدة الحالي (من allUnitsInfo)
        currentLessonSummary: null, // سيحتوي على ملخص الدرس الحالي (من قائمة دروس الوحدة)
        currentLessonFullData: null, // سيحتوي على بيانات الدرس الكاملة بعد جلبها
        dataBasePath: './data/',
    };

    // --- 1. DOM ELEMENT SELECTORS ---
    const mainContentDisplay = document.getElementById('dynamic-content-display');
    const breadcrumbNav = document.getElementById('breadcrumb-navigation');
    const homeLink = document.getElementById('home-link');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const currentYearSpan = document.getElementById('current-year');

    if (!mainContentDisplay) console.error("CRITICAL ERROR: mainContentDisplay element not found!");
    if (!breadcrumbNav) console.error("CRITICAL ERROR: breadcrumbNav element not found!");


    // --- 2. UTILITY FUNCTIONS ---
    function showLoading(show) { if (loadingIndicator) { loadingIndicator.style.display = show ? 'block' : 'none'; } }
    function sanitizeTextAndStructure(htmlString) { if (typeof htmlString !== 'string') return ''; const p = new DOMParser(); const d = p.parseFromString(htmlString, 'text/html'); const aT = ['span', 'br', 'p', 'strong', 'em', 'ul', 'li', 'h4', 'h5', 'i', 'div']; const aSC = ['foreign-phrase-in-rtl']; function sN(n) { if (n.nodeType === Node.TEXT_NODE) { return document.createTextNode(n.textContent); } if (n.nodeType === Node.ELEMENT_NODE) { const tagName = n.tagName.toLowerCase(); if (aT.includes(tagName)) { const newNode = document.createElement(tagName); if (tagName === 'span') { for (const cls of n.classList) if (aSC.includes(cls)) newNode.classList.add(cls); } else if (n.hasAttribute('class') && tagName !== 'script') newNode.className = n.className; if (n.hasAttribute('data-lang-dir')) newNode.setAttribute('data-lang-dir', n.getAttribute('data-lang-dir')); if (tagName !== 'br' && tagName !== 'img') { for (const child of n.childNodes) newNode.appendChild(sN(child)); } return newNode; } else { const fragment = document.createDocumentFragment(); for (const child of n.childNodes) fragment.appendChild(sN(child)); return fragment; } } return document.createDocumentFragment(); } const fragment = document.createDocumentFragment(); for (const child of d.body.childNodes) fragment.appendChild(sN(child)); const tempDiv = document.createElement('div'); tempDiv.appendChild(fragment); return tempDiv.innerHTML; }
    async function fetchData(filePath) {
        console.log("UTIL: Fetching data from:", filePath);
        try { const r = await fetch(filePath); if (!r.ok) { if (r.status === 404) { console.warn(`UTIL: 404 Not Found for ${filePath}`); return null; } throw new Error(`Network error (${r.status}) for ${filePath}`); } const jsonData = await r.json(); console.log("UTIL: Successfully fetched:", filePath); return jsonData; }
        catch (e) { console.error(`UTIL: Fetch error for ${filePath}:`, e); return 'FETCH_ERROR'; }
    }
    window.displayGlobalErrorMessage = function(message, details = '') { showLoading(false); mainContentDisplay.innerHTML = ''; const eD = document.createElement('div'); eD.className = 'error-message'; eD.innerHTML = `<p style="font-weight:bold;font-size:1.2em;">${sanitizeTextAndStructure(message)}</p>${details?`<p style="font-size:0.8em;margin-top:10px;">تفاصيل: ${sanitizeTextAndStructure(details)}</p>`:''}`; mainContentDisplay.appendChild(eD);};
    window.speakText = function(text, lang, onStart, onEnd, onError) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const utt = new SpeechSynthesisUtterance(text); utt.lang = lang; utt.rate = 0.9; utt.pitch = 1; const voices = window.speechSynthesis.getVoices(); let selVoice = voices.find(v => v.lang === lang); if (!selVoice && lang.includes('-')) { const base = lang.split('-')[0]; selVoice = voices.find(v => v.lang.startsWith(base + "-")) || voices.find(v => v.lang === base); } if (!selVoice && lang === "ar-SA") { selVoice = voices.find(v => v.lang.startsWith("ar-") && v.name.toLowerCase().includes("female")) || voices.find(v => v.lang.startsWith("ar-"));} if (selVoice) utt.voice = selVoice; else console.warn(`No specific or fallback voice for ${lang}. Using browser default.`); utt.onstart = onStart || (() => {}); utt.onend = onEnd || (() => {}); utt.onerror = onError || ((ev)=>{console.error('TTS Err', ev);}); window.speechSynthesis.speak(utt); } else { console.error('TTS not supported.'); if(onError)onError({error:'unsupported'}); }};


    // --- 3. RENDERING FUNCTIONS ---
    function renderBreadcrumbs(viewType, unitData, lessonData) {
        console.log("RENDER: renderBreadcrumbs - View:", viewType, "Unit:", unitData?.title_ar, "Lesson:", lessonData?.title_ar);
        let html = `<a href="#" data-hash="">الرئيسية (الوحدات)</a>`;
        if (viewType === 'lessons-list' && unitData) {
            html += ` > <span class="current-crumb">${sanitizeTextAndStructure(unitData.title_ar)} (قائمة الدروس)</span>`;
        } else if (viewType === 'lesson-view' && unitData && lessonData) {
            html += ` > <a href="#unit/${unitData.slug || unitData.folderName}" data-hash="unit/${unitData.slug || unitData.folderName}" class="crumb-link">${sanitizeTextAndStructure(unitData.title_ar)}</a>`;
            html += ` > <span class="current-crumb">${sanitizeTextAndStructure(lessonData.title_ar)}</span>`;
        }
        breadcrumbNav.innerHTML = html;
        breadcrumbNav.querySelectorAll('.crumb-link').forEach(link => {
            link.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = e.target.dataset.hash || ''; });
        });
    }

    function renderUnitsList(units) {
        console.log("RENDER: renderUnitsList with units:", units ? units.length : 0);
        mainContentDisplay.innerHTML = ''; showLoading(false);
        if (!units || units.length === 0) {
            mainContentDisplay.innerHTML = `<p class="info-message">لا توجد وحدات متاحة حالياً. يرجى التأكد من أن ملفات <code>unit-info.json</code> موجودة وصالحة في مجلدات الوحدات داخل <code>/data/</code>، وأنها تحتوي على حقل <code>lessonFiles</code> كمصفوفة (حتى لو فارغة، ولكن يُفضل ألا تكون فارغة لعرض أي شيء).</p>`;
            return;
        }
        let html = `<h2 class="page-section-title"><i class="icon fa-solid fa-cubes"></i> الوحدات التعليمية</h2><div class="cards-grid">`;
        units.forEach(unit => {
            const hashTarget = `unit/${unit.slug || unit.folderName}`;
            const themeClass = unit.theme_color_class || 'theme-default';
            const iconClass = unit.icon_fa_class || 'fa-solid fa-book-open-reader';
            html += `
                <div class="card-item ${themeClass}" data-hash="${hashTarget}" data-unit-id-debug="${unit.id}" 
                     aria-label="افتح وحدة ${sanitizeTextAndStructure(unit.title_ar)}">
                    <div class="card-icon-area"><i class="icon ${iconClass}"></i></div>
                    <h3 class="card-title">${sanitizeTextAndStructure(unit.title_ar)}</h3>
                    <p class="card-subtitle-langs">${sanitizeTextAndStructure(unit.title_en)} / ${sanitizeTextAndStructure(unit.title_tr)}</p>
                    <p class="card-description">${sanitizeTextAndStructure(unit.description_ar)}</p>
                    <div class="card-footer-info">
                        <i class="icon fa-solid fa-layer-group"></i>
                        <span>${(unit.lessonFiles && unit.lessonFiles.length) || 0} دروس</span>
                    </div>
                </div>`;
        });
        html += `</div>`; mainContentDisplay.innerHTML = html;
        mainContentDisplay.querySelectorAll('.card-item[data-hash]').forEach(card => {
            card.addEventListener('click', () => {
                console.log("RENDER: Unit card clicked. Hash to set:", card.dataset.hash);
                window.location.hash = card.dataset.hash;
            });
        });
    }

    function renderLessonsList(lessons, unitInfo) {
        console.log("RENDER: renderLessonsList for unit:", unitInfo?.title_ar, "with lessons:", lessons ? lessons.length : 0);
        mainContentDisplay.innerHTML = ''; showLoading(false);
        if (!unitInfo) { displayGlobalErrorMessage("خطأ: معلومات الوحدة مفقودة لعرض الدروس."); return; }
        let html = `<h2 class="page-section-title"><i class="icon ${unitInfo.icon_fa_class || 'fa-solid fa-book-open-reader'}"></i> دروس وحدة: ${sanitizeTextAndStructure(unitInfo.title_ar)}</h2>`;
        if (!lessons || lessons.length === 0) {
            html += `<p class="info-message">لا توجد دروس متاحة لهذه الوحدة حاليًا أو لم يتم العثور على ملفات الدروس. تأكد أن مصفوفة <code>lessonFiles</code> في <code>${unitInfo.folderName}/unit-info.json</code> صحيحة وأن الملفات المشار إليها موجودة.</p>`;
            mainContentDisplay.innerHTML = html;
            return;
        }
        html += `<div class="cards-grid lessons-list-specific">`;
        lessons.forEach(lesson => { // lesson هو ملخص الدرس الآن
            const iconClass = lesson.icon_fa_class || 'fa-solid fa-chalkboard-user';
            const hashTarget = `unit/${unitInfo.slug || unitInfo.folderName}/lesson/${lesson.fileBaseName}`;
            html += `<div class="card-item lesson-card-list-item" data-hash="${hashTarget}" data-lesson-id-debug="${lesson.id}" aria-label="ابدأ ${sanitizeTextAndStructure(lesson.title_ar)}"><div class="card-icon-area"><i class="icon ${iconClass}"></i></div><h3 class="card-title">${sanitizeTextAndStructure(lesson.title_ar)}</h3> <p class="card-subtitle-langs">${sanitizeTextAndStructure(lesson.title_en)} / ${sanitizeTextAndStructure(lesson.title_tr)}</p><p class="card-description" style="font-style: italic; font-size:0.85em;">${sanitizeTextAndStructure(lesson.objective_ar)}</p><div class="card-footer-info"><i class="icon fa-solid fa-list-ul"></i><span>${lesson.phrases_count||0} عبارات</span></div></div>`;
        });
        html += `</div>`; mainContentDisplay.innerHTML = html;
        mainContentDisplay.querySelectorAll('.card-item[data-hash]').forEach(card => {
            card.addEventListener('click', () => {
                console.log("RENDER: Lesson card clicked. Hash to set:", card.dataset.hash);
                window.location.hash = card.dataset.hash;
            });
        });
    }

    function renderLessonView(lessonFullData, unitDataForNav, allLessonsInThisUnitForNav) {
        console.log("RENDER: renderLessonView CALLED for lesson:", lessonFullData?.title_ar);
        mainContentDisplay.innerHTML = ''; showLoading(false);
        if (!lessonFullData || lessonFullData === 'FETCH_ERROR' || !lessonFullData.id) { displayGlobalErrorMessage("خطأ فادح في عرض محتوى الدرس."); return; }

        const isScenarioLesson = lessonFullData.scenario && lessonFullData.phrases_analysis;
        let html = `<div class="lesson-header-view"><i class="icon ${lessonFullData.icon_fa_class||'fa-solid fa-person-chalkboard'}"></i><h1>${sanitizeTextAndStructure(lessonFullData.title_ar)}</h1><p class="lesson-view-subtitle" data-lang-dir="ltr">${sanitizeTextAndStructure(lessonFullData.title_en)} / ${sanitizeTextAndStructure(lessonFullData.title_tr)}</p><p class="lesson-view-objective" data-lang-dir="rtl">${sanitizeTextAndStructure(lessonFullData.objective_ar)}</p></div>`;
        if (isScenarioLesson) {
            html += `<div class="full-dialogue-section">`; const charactersMap = new Map(lessonFullData.scenario.characters.map(char => [char.id, char]));
            html += `<div class="dialogue-language-block" data-lang-dir="rtl"><h3 class="dialogue-lang-title"><span class="flag-icon">🇸🇦</span> الحوار بالعربية</h3><ul class="dialogue-lines-list">`; lessonFullData.scenario.dialogue_lines.forEach(line => { const character = charactersMap.get(line.character_id); const charName = character ? sanitizeTextAndStructure(character.name_ar) : 'متحدث'; const charColorClass = character ? `${character.id}-color` : ''; html += `<li class="dialogue-line-item"><strong class="line-character-name ${charColorClass}">${charName}:</strong><span class="line-text-content">${sanitizeTextAndStructure(line.line_ar)}</span><button class="line-speak-btn" data-text="${sanitizeTextAndStructure(line.line_ar)}" data-lang="ar-SA" title="نطق"><i class="fa-solid fa-volume-high"></i></button></li>`; }); html += `</ul></div>`;
            html += `<div class="dialogue-language-block" data-lang-dir="ltr"><h3 class="dialogue-lang-title"><span class="flag-icon flag-icon-gb"></span>Dialogue in English</h3><ul class="dialogue-lines-list">`; lessonFullData.scenario.dialogue_lines.forEach(line => { const character = charactersMap.get(line.character_id); const charName = character ? sanitizeTextAndStructure(character.name_en) : 'Speaker'; const charColorClass = character ? `${character.id}-color` : ''; html += `<li class="dialogue-line-item"><strong class="line-character-name ${charColorClass}">${charName}:</strong><span class="line-text-content">${sanitizeTextAndStructure(line.line_en)}</span><button class="line-speak-btn" data-text="${sanitizeTextAndStructure(line.line_en)}" data-lang="en-US" title="Speak"><i class="fa-solid fa-volume-high"></i></button></li>`; }); html += `</ul></div>`;
            html += `<div class="dialogue-language-block" data-lang-dir="ltr"><h3 class="dialogue-lang-title"><span class="flag-icon flag-icon-tr"></span>Türkçe Diyalog</h3><ul class="dialogue-lines-list">`; lessonFullData.scenario.dialogue_lines.forEach(line => { const character = charactersMap.get(line.character_id); const charNameTr = character ? sanitizeTextAndStructure(character.name_tr) : 'Konuşmacı'; const lineTrText = line.line_tr; const charColorClass = character ? `${character.id}-color` : ''; html += `<li class="dialogue-line-item"><strong class="line-character-name ${charColorClass}">${charNameTr}:</strong><span class="line-text-content">${sanitizeTextAndStructure(lineTrText)}</span><button class="line-speak-btn" data-text="${sanitizeTextAndStructure(lineTrText)}" data-lang="tr-TR" title="Seslendir"><i class="fa-solid fa-volume-high"></i></button></li>`; }); html += `</ul></div>`; html += `</div>`;
            if (lessonFullData.phrases_analysis && lessonFullData.phrases_analysis.length > 0) {
                html += `<div class="phrases-analysis-container"><h2 class="analysis-title">تحليل العبارات الرئيسية</h2><div class="lesson-phrases-list">`;
                lessonFullData.phrases_analysis.forEach(phrase => { const arSpeakText = phrase.audio_ar_tts_key || phrase.ar_from_dialogue; const enSpeakText = phrase.audio_en_tts_key || phrase.en_from_dialogue; const trSpeakText = phrase.audio_tr_tts_key || phrase.tr_from_dialogue; html += `<div class="phrase-card-item" id="phrase-analysis-${sanitizeTextAndStructure(phrase.id)}"><p class="phrase-main-ar original-from-dialogue">من الحوار: <em>"${sanitizeTextAndStructure(phrase.ar_from_dialogue)}"</em></p><div class="phrase-focus-section"><p><strong><i class="fa-solid fa-bullseye"></i> التركيز الأساسي:</strong> ${sanitizeTextAndStructure(phrase.focus_ar)}</p></div><div class="phrase-actions"><button class="speak-btn speak-ar" data-text="${sanitizeTextAndStructure(arSpeakText)}" data-lang="ar-SA"><i class="fa-solid fa-volume-high"></i> العربية</button><button class="speak-btn speak-en" data-text="${sanitizeTextAndStructure(enSpeakText)}" data-lang="en-US"><i class="fa-solid fa-volume-high"></i> الإنجليزية</button><button class="speak-btn speak-tr" data-text="${sanitizeTextAndStructure(trSpeakText)}" data-lang="tr-TR"><i class="fa-solid fa-volume-high"></i> التركية</button></div><div class="phrase-translations-grid"><div class="translation-block lang-en"><p class="lang-label"><span class="flag-icon flag-icon-gb"></span>English Focus: ${sanitizeTextAndStructure(phrase.focus_en)}</p><p class="phrase-text">${sanitizeTextAndStructure(phrase.en_from_dialogue)}</p>${phrase.explanation_en ? `<p class="explanation-text" data-lang-dir="ltr">${sanitizeTextAndStructure(phrase.explanation_en)}</p>` : ''}${phrase.alternatives_en && phrase.alternatives_en.length > 0 ? `<p class="alternatives-text" data-lang-dir="ltr"><strong>Alternatives:</strong> ${phrase.alternatives_en.map(s => sanitizeTextAndStructure(s)).join(' / ')}</p>` : ''}</div><div class="translation-block lang-tr"><p class="lang-label"><span class="flag-icon flag-icon-tr"></span>Türkçe Odak: ${sanitizeTextAndStructure(phrase.focus_tr)}</p><p class="phrase-text">${sanitizeTextAndStructure(phrase.tr_from_dialogue)}</p>${phrase.explanation_tr ? `<p class="explanation-text" data-lang-dir="ltr">${sanitizeTextAndStructure(phrase.explanation_tr)}</p>` : ''}${phrase.alternatives_tr && phrase.alternatives_tr.length > 0 ? `<p class="alternatives-text" data-lang-dir="ltr"><strong>Alternatifler:</strong> ${phrase.alternatives_tr.map(s => sanitizeTextAndStructure(s)).join(' / ')}</p>` : ''}</div></div></div>`; });
                html += `</div></div>`;
            }
        } else if (lessonFullData.phrases && lessonFullData.phrases.length > 0) {
            html += `<div class="lesson-phrases-list">`; let cat = null;
            lessonFullData.phrases.forEach(p => { /* ... (نفس كود بناء HTML للعبارات المصنفة) ... */ }); if (cat) html+=`</div>`; html += `</div>`;
        } else { html += `<p class="info-message">لا يوجد محتوى تفصيلي لهذا الدرس حاليًا.</p>`; }
        if (allLessonsInThisUnitForNav && allLessonsInThisUnitForNav.length > 1) { const currentIdx = allLessonsInThisUnitForNav.findIndex(l => l.id === lessonFullData.id); html += `<div class="lesson-navigation">`; if (currentIdx > 0) { const prev = allLessonsInThisUnitForNav[currentIdx-1]; html+=`<button class="lesson-nav-btn prev" data-hash="unit/${unitDataForNav.slug||unitDataForNav.folderName}/lesson/${prev.fileBaseName}"><i class="fa-solid fa-arrow-right"></i> السابق</button>`; } else { html+=`<button class="lesson-nav-btn prev disabled" disabled><i class="fa-solid fa-arrow-right"></i> السابق</button>`; } if (currentIdx < allLessonsInThisUnitForNav.length - 1) { const next = allLessonsInThisUnitForNav[currentIdx+1]; html+=`<button class="lesson-nav-btn next" data-hash="unit/${unitDataForNav.slug||unitDataForNav.folderName}/lesson/${next.fileBaseName}">التالي <i class="fa-solid fa-arrow-left"></i></button>`; } else { html+=`<button class="lesson-nav-btn next disabled" disabled>التالي <i class="fa-solid fa-arrow-left"></i></button>`; } html += `</div>`;}
        mainContentDisplay.innerHTML = html;
        mainContentDisplay.querySelectorAll('.speak-btn, .line-speak-btn').forEach(b => { b.addEventListener('click', function(){ const txt=this.dataset.text; const lng=this.dataset.lang; if(typeof speakText==='function'){ const btn=this; window.speechSynthesis.cancel(); document.querySelectorAll('.speak-btn.speaking, .line-speak-btn.speaking').forEach(oBtn => oBtn.classList.remove('speaking')); btn.classList.add('speaking'); speakText(txt,lng,null,()=>btn.classList.remove('speaking'),(e)=>{btn.classList.remove('speaking');console.error("TTS Err",e); const errS=document.createElement('span');errS.textContent=' خطأ!'; errS.style.color='red'; errS.style.fontSize='0.7em'; btn.appendChild(errS); setTimeout(()=>errS.remove(),2000); });}});});
        mainContentDisplay.querySelectorAll('.lesson-nav-btn:not(.disabled)').forEach(b => { b.addEventListener('click', function(){ window.location.hash = this.dataset.hash; });});
        checkScreenSizeForTranslations();
    }

    // --- 4. ROUTING AND DATA LOADING ---
    const unitFolders = ['unit_01_daily_scenarios_problem_solving', 'unit_02_daily_life_activities', 'unit_03_people_and_relationships', 'unit_04_navigating_and_exploring', 'unit_05_opinions_and_discussions', 'unit_06_advanced_communication_and_nuances'];

    async function loadAllUnitInfos() {
        if (appState.allUnitsInfo.length > 0) return; // Load only once
        console.log("ROUTER: Initial load of all unit infos.");
        const promises = unitFolders.map(async (folder) => {
            const info = await fetchData(`${appState.dataBasePath}${folder}/unit-info.json`);
            return info ? { ...info, folderName: folder, slug: info.slug || folder } : null;
        });
        appState.allUnitsInfo = (await Promise.all(promises)).filter(u => u && u.id && Array.isArray(u.lessonFiles));
        console.log("ROUTER: All unit infos loaded:", appState.allUnitsInfo.length, "units.");
    }

    async function getLessonsSummaryForUnit(unitInfo) {
        if (!unitInfo || !Array.isArray(unitInfo.lessonFiles)) return [];
        console.log(`ROUTER_HELPER: Getting lessons summary for unit: ${unitInfo.folderName}`);
        let summaries = [];
        for (const fileBaseName of unitInfo.lessonFiles) {
            const lessonFilePath = `${appState.dataBasePath}${unitInfo.folderName}/${fileBaseName}.json`;
            const lessonData = await fetchData(lessonFilePath);
            if (lessonData && lessonData.id && lessonData.title_ar) {
                summaries.push({ id: lessonData.id, fileBaseName: fileBaseName, title_ar: lessonData.title_ar, title_en: lessonData.title_en, title_tr: lessonData.title_tr, objective_ar: lessonData.objective_ar, icon_fa_class: lessonData.icon_fa_class, phrases_count: (lessonData.phrases_analysis?.length || lessonData.phrases?.length || 0), filePath: lessonFilePath });
            }
        }
        return summaries;
    }

    async function router() {
        const hash = window.location.hash.substring(1);
        const parts = hash.split('/');
        const viewTypeFromHash = parts[0];
        const unitSlugFromHash = parts[1];
        const lessonKeywordFromHash = parts[2];
        const lessonFileBaseNameFromHash = parts[3];
        console.log(`ROUTER: Processing Hash - '${hash}'`);
        showLoading(true);

        if (appState.allUnitsInfo.length === 0) {
            await loadAllUnitInfos(); //  Load unit master list if not already loaded
        }

        let targetUnit = null;
        if (unitSlugFromHash) {
            targetUnit = appState.allUnitsInfo.find(u => u.slug === unitSlugFromHash);
        }

        if (viewTypeFromHash === 'unit' && targetUnit) {
            appState.currentUnitInfo = targetUnit; //  مهم للـ breadcrumbs ودوال العرض التالية

            if (lessonKeywordFromHash === 'lesson' && lessonFileBaseNameFromHash) {
                // عرض درس معين
                console.log(`ROUTER: Showing lesson '${lessonFileBaseNameFromHash}' of unit '${targetUnit.folderName}'`);
                // تحميل ملخصات الدروس للوحدة الحالية إذا لم تكن محملة بعد أو إذا تغيرت الوحدة
                if (!appState.allLessonsInCurrentUnit.length || !appState.allLessonsInCurrentUnit[0]?.filePath.includes(targetUnit.folderName)) {
                    appState.allLessonsInCurrentUnit = await getLessonsSummaryForUnit(targetUnit);
                }
                const lessonSummary = appState.allLessonsInCurrentUnit.find(l => l.fileBaseName === lessonFileBaseNameFromHash);
                if (lessonSummary && lessonSummary.filePath) {
                    const lessonFullData = await fetchData(lessonSummary.filePath);
                    if (lessonFullData && lessonFullData.id) {
                        appState.currentLessonInfo = lessonFullData; // نخزن البيانات الكاملة للدرس المعروض
                        renderBreadcrumbs('lesson-view', targetUnit, lessonFullData);
                        renderLessonView(lessonFullData, targetUnit, appState.allLessonsInCurrentUnit);
                    } else { displayGlobalErrorMessage(`خطأ تحميل محتوى الدرس '${lessonFileBaseNameFromHash}'.`); }
                } else { console.error(`Lesson summary '${lessonFileBaseNameFromHash}' not found.`); window.location.hash = `unit/${targetUnit.slug}`; }
            } else {
                // عرض قائمة دروس الوحدة
                console.log(`ROUTER: Showing lessons list for unit '${targetUnit.folderName}'`);
                const lessonsToRender = await getLessonsSummaryForUnit(targetUnit);
                appState.allLessonsInCurrentUnit = lessonsToRender; // نخزن للوصول السريع لاحقًا
                renderBreadcrumbs('lessons-list', targetUnit);
                renderLessonsList(lessonsToRender, targetUnit);
            }
        } else {
            // عرض قائمة الوحدات
            console.log("ROUTER: Defaulting to units list.");
            appState.currentUnitInfo = null; appState.allLessonsInCurrentUnit = []; appState.currentLessonInfo = null;
            renderBreadcrumbs('units-list');
            renderUnitsList(appState.allUnitsInfo);
        }
    }

    // --- 5. EVENT LISTENERS & INITIALIZATION ---
    homeLink.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = ""; });
    function applyTheme(theme) { if (theme === 'dark') {document.body.classList.add('dark-theme');themeToggleButton.innerHTML = '<i class="fa-solid fa-sun"></i>';} else {document.body.classList.remove('dark-theme');themeToggleButton.innerHTML = '<i class="fa-solid fa-moon"></i>';}localStorage.setItem('lughatiTheme', theme);}
    themeToggleButton.addEventListener('click', () => {const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); });
    const savedTheme = localStorage.getItem('lughatiTheme'); if (savedTheme) { applyTheme(savedTheme); } else { applyTheme('light'); }
    if (currentYearSpan) { currentYearSpan.textContent = new Date().getFullYear(); }
    function checkScreenSizeForTranslations() {if (window.innerWidth > 768) {document.body.classList.add('large-screen');} else {document.body.classList.remove('large-screen');}}
    window.addEventListener('resize', checkScreenSizeForTranslations); checkScreenSizeForTranslations();
    // speakText و displayGlobalErrorMessage (نسخ الدوال الكاملة من الرد السابق هنا)

    window.addEventListener('hashchange', router);
    router();
    console.log("SCRIPT.JS: Initialized. Router called based on initial hash or default.");
});