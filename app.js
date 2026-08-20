// ==========================================================
// 1. CONFIGURATION & STATE
// ==========================================================
const WORKER_URL = 'https://e-paper-naidunia.rkkillerbaba.workers.dev';

let currentPagesList = [];
let activePageIndex = 0;

// Viewer Pan & Zoom State Engine
let zoomScale = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Get Indian Standard Time (IST) Date string (YYYY-MM-DD)
function getTodayIST() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    return istDate.toISOString().split('T')[0];
}

// ==========================================================
// 2. THEME ENGINE (Dark / Light Mode)
// ==========================================================
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const html = document.documentElement;

function initTheme() {
    const savedTheme = localStorage.getItem('pulse_theme') || 'dark';
    if (savedTheme === 'light') {
        html.classList.remove('dark');
        themeIcon.className = 'fa-solid fa-sun text-amber-500';
    } else {
        html.classList.add('dark');
        themeIcon.className = 'fa-solid fa-moon text-amber-400';
    }
}
initTheme();

themeToggle.addEventListener('click', () => {
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('pulse_theme', isDark ? 'dark' : 'light');
    themeIcon.className = isDark ? 'fa-solid fa-moon text-amber-400' : 'fa-solid fa-sun text-amber-500';
});

// ==========================================================
// 3. DATE & EDITION CONTROLS
// ==========================================================
const paperDateInput = document.getElementById('paperDate');
const editionSelect = document.getElementById('editionSelect');

// Set Today's IST Date on launch
paperDateInput.value = getTodayIST();

function changeDateByDays(days) {
    const currentDate = new Date(paperDateInput.value || getTodayIST());
    currentDate.setDate(currentDate.getDate() + days);
    
    const newDateStr = currentDate.toISOString().split('T')[0];
    paperDateInput.value = newDateStr;
    handleDateOrEditionChange();
}

function setTodayDate() {
    paperDateInput.value = getTodayIST();
    handleDateOrEditionChange();
}

function handleDateOrEditionChange() {
    const dateVal = paperDateInput.value || getTodayIST();
    const eidVal = editionSelect.value || '62';
    const selectedCityText = editionSelect.options[editionSelect.selectedIndex].text.split(' ')[0];
    
    const dateObj = new Date(dateVal);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('editionHeadline').innerText = `${selectedCityText} Edition`;
    document.getElementById('editionDateFormatted').innerText = dateObj.toLocaleDateString('en-US', options);
    
    loadEpaperData(dateVal, eidVal);
}

paperDateInput.addEventListener('change', handleDateOrEditionChange);
editionSelect.addEventListener('change', handleDateOrEditionChange);

// ==========================================================
// 4. MAIN DATA FETCHER (WORKER CONNECTED)
// ==========================================================
async function loadEpaperData(dateStr, eid) {
    renderSkeletons();
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('pagesGrid').classList.add('hidden');

    try {
        const response = await fetch(`${WORKER_URL}?date=${dateStr}&eid=${eid}`);
        const data = await response.json();

        if (data.success && data.pages && data.pages.length > 0) {
            currentPagesList = data.pages;
            document.getElementById('editionHeadline').innerText = `${data.meta.city} Edition`;
            if (data.meta?.formattedDate) {
                document.getElementById('editionDateFormatted').innerText = data.meta.formattedDate;
            }
            renderPagesGrid(currentPagesList);
        } else {
            showNoDataState(dateStr, data.message);
        }
    } catch (err) {
        console.error("Worker fetch error:", err);
        showNoDataState(dateStr, "Worker connect nahi ho pa raha hai.");
    }
}

function showNoDataState(dateStr, message) {
    const loader = document.getElementById('loader');
    const grid = document.getElementById('pagesGrid');
    const selectedCityText = editionSelect.options[editionSelect.selectedIndex].text;

    loader.classList.add('hidden');
    grid.classList.remove('hidden');
    
    grid.innerHTML = `
        <div class="col-span-full py-16 text-center glass-card rounded-3xl border border-slate-200 dark:border-white/10 p-8 shadow-sm">
            <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                <i class="fa-solid fa-calendar-xmark"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-1">${selectedCityText} का ई-पेपर उपलब्ध नहीं है</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                ${message || `तारीख (${dateStr}) का पेपर अभी ऑनलाइन अपलोड नहीं हुआ है।`}
            </p>
            <button onclick="changeDateByDays(-1)" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition shadow">
                <i class="fa-solid fa-chevron-left mr-1"></i> पिछले दिन का देखें
            </button>
        </div>
    `;
    document.getElementById('pageCountBadge').innerText = `• 0 Pages`;
    document.getElementById('filmstripContainer').innerHTML = '';
}

function renderSkeletons() {
    const loader = document.getElementById('loader');
    loader.innerHTML = '';
    for(let i=0; i<8; i++) {
        loader.innerHTML += `
            <div class="glass-card rounded-3xl p-3.5 border border-slate-200/60 dark:border-white/5 animate-pulse">
                <div class="w-full aspect-[1/1.4] bg-slate-200 dark:bg-slate-800/60 rounded-2xl mb-3"></div>
                <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3 mb-2"></div>
                <div class="h-3 bg-slate-200 dark:bg-slate-800/40 rounded-lg w-2/3"></div>
            </div>
        `;
    }
}

function renderPagesGrid(pages) {
    const grid = document.getElementById('pagesGrid');
    const loader = document.getElementById('loader');
    grid.innerHTML = '';

    pages.forEach((page, index) => {
        const card = document.createElement('div');
        card.className = "card-3d-wrap group";
        
        card.innerHTML = `
            <div class="card-3d glass-card rounded-3xl p-3.5 border border-slate-200/80 dark:border-white/10 shadow-lg flex flex-col justify-between">
                <div class="relative w-full aspect-[1/1.4] rounded-2xl overflow-hidden cursor-pointer bg-slate-100 dark:bg-slate-900" onclick="openCinemaViewer(${index})">
                    <img src="${page.page_image}" alt="Page ${page.pageno}" loading="lazy" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-4">
                        <span class="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-xl shadow-lg">
                            <i class="fa-solid fa-magnifying-glass-plus mr-1"></i> Read Full Page
                        </span>
                    </div>
                </div>

                <div class="mt-3.5 px-1.5 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] font-extrabold tracking-wider uppercase text-brand-500">PAGE</span>
                        <h4 class="text-base font-black text-slate-800 dark:text-white">
                            #${page.pageno < 10 ? '0' + page.pageno : page.pageno}
                        </h4>
                    </div>
                    
                    <div class="flex items-center gap-1.5">
                        <button onclick="openCinemaViewer(${index})" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-brand-500 hover:text-white dark:bg-night-surface dark:hover:bg-brand-500 text-slate-600 dark:text-slate-300 flex items-center justify-center transition" title="Read Page">
                            <i class="fa-solid fa-eye text-xs"></i>
                        </button>
                        <a href="${page.page_pdf}" target="_blank" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-night-surface dark:hover:bg-indigo-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition" title="Download PDF">
                            <i class="fa-solid fa-file-pdf text-xs"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    renderFilmstrip(pages);
    loader.classList.add('hidden');
    grid.classList.remove('hidden');
    document.getElementById('pageCountBadge').innerText = `• ${pages.length} Pages Ready`;
}

// ==========================================================
// 5. CINEMA VIEWER (MANUAL ZOOM & PAN ENGINE)
// ==========================================================
const cinemaModal = document.getElementById('cinemaModal');
const cinemaImg = document.getElementById('cinemaImg');
const zoomContainer = document.getElementById('zoomContainer');
const viewportStage = document.getElementById('viewportStage');
const zoomRangeSlider = document.getElementById('zoomRangeSlider');
const zoomPercentBadge = document.getElementById('zoomPercentBadge');

function openCinemaViewer(index) {
    activePageIndex = index;
    const page = currentPagesList[activePageIndex];
    const cityName = page.formattedCity || document.getElementById('editionHeadline').innerText.replace(' Edition', '');
    
    document.getElementById('modalPageTitle').innerText = `${cityName} Edition - Page ${page.pageno}`;
    document.getElementById('modalPageNumberBadge').innerText = `P.${page.pageno < 10 ? '0'+page.pageno : page.pageno}`;
    document.getElementById('modalDownloadPdfBtn').href = page.page_pdf;

    cinemaImg.src = page.page_largeimage;
    resetZoom();
    
    cinemaModal.classList.remove('hidden');
    setTimeout(() => cinemaModal.classList.remove('opacity-0'), 10);
    
    highlightFilmstrip(activePageIndex);
    document.body.style.overflow = 'hidden';
}

function closeCinemaModal() {
    cinemaModal.classList.add('opacity-0');
    setTimeout(() => {
        cinemaModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }, 300);
}

function navigatePage(direction) {
    activePageIndex += direction;
    if (activePageIndex < 0) activePageIndex = currentPagesList.length - 1;
    if (activePageIndex >= currentPagesList.length) activePageIndex = 0;
    openCinemaViewer(activePageIndex);
}

function updateTransform() {
    zoomContainer.style.transform = `translate3d(${panX}px, ${panY}px, 0px) scale(${zoomScale})`;
    zoomRangeSlider.value = zoomScale;
    zoomPercentBadge.innerText = `${Math.round(zoomScale * 100)}%`;
}

function setExactZoom(val) {
    zoomScale = Math.min(Math.max(0.5, val), 3.5);
    if (zoomScale <= 1) {
        panX = 0;
        panY = 0;
    }
    updateTransform();
}

function zoomStep(delta) { setExactZoom(zoomScale + delta); }
function fitWidthZoom() { zoomScale = 1.8; panX = 0; panY = 0; updateTransform(); }
function resetZoom() { zoomScale = 1; panX = 0; panY = 0; updateTransform(); }

zoomRangeSlider.addEventListener('input', (e) => setExactZoom(parseFloat(e.target.value)));

// Mouse Drag/Pan
viewportStage.addEventListener('mousedown', (e) => {
    if (e.target.closest('#zoomContainer') || e.target === viewportStage) {
        isDragging = true;
        dragStartX = e.clientX - panX;
        dragStartY = e.clientY - panY;
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    updateTransform();
});

window.addEventListener('mouseup', () => isDragging = false);

// Touch Support for Mobile
let touchStartDist = 0;
let initialZoom = 1;

viewportStage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX - panX;
        dragStartY = e.touches[0].clientY - panY;
    } else if (e.touches.length === 2) {
        isDragging = false;
        touchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = zoomScale;
    }
});

viewportStage.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
        panX = e.touches[0].clientX - dragStartX;
        panY = e.touches[0].clientY - dragStartY;
        updateTransform();
    } else if (e.touches.length === 2 && touchStartDist > 0) {
        const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        setExactZoom(initialZoom * (currentDist / touchStartDist));
    }
});

viewportStage.addEventListener('touchend', () => {
    isDragging = false;
    touchStartDist = 0;
});

// Filmstrip
function renderFilmstrip(pages) {
    const container = document.getElementById('filmstripContainer');
    container.innerHTML = '';
    pages.forEach((page, i) => {
        const thumb = document.createElement('img');
        thumb.src = page.page_image;
        thumb.className = `film-thumb h-11 w-8 object-cover rounded cursor-pointer border-2 transition opacity-60 hover:opacity-100 ${i === activePageIndex ? 'border-brand-500 opacity-100 scale-105' : 'border-transparent'}`;
        thumb.onclick = () => openCinemaViewer(i);
        container.appendChild(thumb);
    });
}

function highlightFilmstrip(index) {
    const thumbs = document.querySelectorAll('.film-thumb');
    thumbs.forEach((th, i) => {
        if (i === index) {
            th.classList.add('border-brand-500', 'opacity-100', 'scale-105');
            th.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        } else {
            th.classList.remove('border-brand-500', 'opacity-100', 'scale-105');
        }
    });
}

window.addEventListener('keydown', (e) => {
    if (cinemaModal.classList.contains('hidden') && downloadHubModal.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
        closeCinemaModal();
        closeDownloadHub();
    }
    if (e.key === 'ArrowRight') navigatePage(1);
    if (e.key === 'ArrowLeft') navigatePage(-1);
    if (e.key === '+' || e.key === '=') zoomStep(0.25);
    if (e.key === '-') zoomStep(-0.25);
    if (e.key === '0') resetZoom();
});

// ==========================================================
// 6. CUSTOM DOWNLOAD HUB MODAL
// ==========================================================
const downloadHubModal = document.getElementById('downloadHubModal');
const downloadModalCard = document.getElementById('downloadModalCard');

function openDownloadHub() {
    const listContainer = document.getElementById('downloadPagesList');
    listContainer.innerHTML = '';

    if (!currentPagesList || currentPagesList.length === 0) {
        listContainer.innerHTML = `<p class="col-span-full text-center text-xs text-slate-500 py-4">कोई पेज उपलब्ध नहीं है।</p>`;
    } else {
        currentPagesList.forEach(page => {
            const btn = document.createElement('a');
            btn.href = page.page_pdf;
            btn.target = '_blank';
            btn.className = 'flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-brand-500 hover:text-white dark:bg-night-surface dark:hover:bg-brand-500 text-slate-700 dark:text-slate-200 text-xs font-bold transition group shadow-sm';
            btn.innerHTML = `
                <span class="flex items-center gap-1.5">
                    <i class="fa-solid fa-file-pdf text-brand-500 group-hover:text-white transition"></i>
                    Page ${page.pageno}
                </span>
                <i class="fa-solid fa-arrow-down text-[10px] opacity-60 group-hover:opacity-100"></i>
            `;
            listContainer.appendChild(btn);
        });
    }

    downloadHubModal.classList.remove('hidden');
    setTimeout(() => {
        downloadHubModal.classList.remove('opacity-0');
        downloadModalCard.classList.remove('scale-95');
        downloadModalCard.classList.add('scale-100');
    }, 10);
}

function closeDownloadHub() {
    downloadModalCard.classList.remove('scale-100');
    downloadModalCard.classList.add('scale-95');
    downloadHubModal.classList.add('opacity-0');
    setTimeout(() => {
        downloadHubModal.classList.add('hidden');
    }, 200);
}

downloadHubModal.addEventListener('click', (e) => {
    if (e.target === downloadHubModal) {
        closeDownloadHub();
    }
});

// Auto-boot Today's Live Paper
handleDateOrEditionChange();
