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
// 3. DATE & EDITION CONTROLS (Next / Prev & Switcher)
// ==========================================================
const paperDateInput = document.getElementById('paperDate');

function changeDateByDays(days) {
    const currentDate = new Date(paperDateInput.value || '2026-08-19');
    currentDate.setDate(currentDate.getDate() + days);
    
    const newDateStr = currentDate.toISOString().split('T')[0];
    paperDateInput.value = newDateStr;
    handleDateOrEditionChange();
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    paperDateInput.value = today;
    handleDateOrEditionChange();
}

function handleDateOrEditionChange() {
    const dateVal = paperDateInput.value || '2026-08-19';
    const eidVal = document.getElementById('editionSelect').value || '62';
    
    // Format Display Date (e.g. Wednesday, 19 August 2026)
    const dateObj = new Date(dateVal);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('editionDateFormatted').innerText = dateObj.toLocaleDateString('en-US', options);
    
    loadEpaperData(dateVal, eidVal);
}

paperDateInput.addEventListener('change', handleDateOrEditionChange);
document.getElementById('editionSelect').addEventListener('change', handleDateOrEditionChange);

// ==========================================================
// 4. DATA LOADER & RENDER ENGINE (Worker Connection)
// ==========================================================
async function loadEpaperData(dateStr, eid) {
    renderSkeletons();
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('pagesGrid').classList.add('hidden');

    try {
        const response = await fetch(`${WORKER_URL}?date=${dateStr}&eid=${eid}`);
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success && data.pages && data.pages.length > 0) {
            currentPagesList = data.pages;
            const cityName = data.meta?.city || document.getElementById('editionSelect').options[document.getElementById('editionSelect').selectedIndex].text.split(' ')[0];
            document.getElementById('editionHeadline').innerText = `${cityName} Edition`;
            if (data.meta?.formattedDate) {
                document.getElementById('editionDateFormatted').innerText = data.meta.formattedDate;
            }
            renderPagesGrid(currentPagesList);
        } else if (data.pageProps && data.pageProps.data && data.pageProps.data.length > 0) {
            currentPagesList = data.pageProps.data;
            document.getElementById('editionHeadline').innerText = `${data.pageProps.data[0].formattedCity || 'City'} Edition`;
            renderPagesGrid(currentPagesList);
        } else {
            showNoDataState(dateStr);
        }
    } catch (err) {
        console.error("Worker fetch error:", err);
        showNoDataState(dateStr);
    }
}

function showNoDataState(dateStr) {
    const loader = document.getElementById('loader');
    const grid = document.getElementById('pagesGrid');
    loader.classList.add('hidden');
    grid.classList.remove('hidden');
    
    grid.innerHTML = `
        <div class="col-span-full py-16 text-center glass-card rounded-3xl border border-slate-200 dark:border-white/10 p-8 shadow-sm">
            <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                <i class="fa-solid fa-calendar-xmark"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-1">E-Paper Uplabdh Nahi Hai</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Tareekh (${dateStr}) ka e-paper abhi archive me upload nahi hua hai. Kripya dusri date select karein.
            </p>
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
                        <button onclick="openCinemaViewer(${index})" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-brand-500 hover:text-white dark:bg-night-surface dark:hover:bg-brand-500 text-slate-600 dark:text-slate-300 flex items-center justify-center transition">
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

function zoomStep(delta) {
    setExactZoom(zoomScale + delta);
}

function fitWidthZoom() {
    zoomScale = 1.8;
    panX = 0;
    panY = 0;
    updateTransform();
}

function resetZoom() {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    updateTransform();
}

zoomRangeSlider.addEventListener('input', (e) => {
    setExactZoom(parseFloat(e.target.value));
});

// Mouse Drag / Pan Events
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

// Mouse Wheel Zoom
viewportStage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setExactZoom(zoomScale + delta);
}, { passive: false });

// Mobile Touch Drag & Pinch Zoom Events
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
        const scaleDiff = currentDist / touchStartDist;
        setExactZoom(initialZoom * scaleDiff);
    }
});

viewportStage.addEventListener('touchend', () => {
    isDragging = false;
    touchStartDist = 0;
});

// ==========================================================
// 6. FILMSTRIP & KEYBOARD SHORTCUTS
// ==========================================================
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
    if (cinemaModal.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeCinemaModal();
    if (e.key === 'ArrowRight') navigatePage(1);
    if (e.key === 'ArrowLeft') navigatePage(-1);
    if (e.key === '+' || e.key === '=') zoomStep(0.25);
    if (e.key === '-') zoomStep(-0.25);
    if (e.key === '0') resetZoom();
});

function downloadAllPages() {
    alert("Aap kisi bhi page ke PDF icon par click karke direct page download kar sakte hain.");
}

// Initial Boot (Fetches the selected date dynamically via Worker)
handleDateOrEditionChange();
