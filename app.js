/* --- snap-aesthetic-hd: app.js --- */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // --- STATE ---
  const state = {
    stream: null,
    devices: [],
    currentDeviceIndex: 0,
    facingMode: 'user', // 'user' or 'environment'
    layout: 'strip-4', // 'strip-4', 'strip-3', 'grid-2x2', 'polaroid-single', 'landscape-single'
    filter: 'normal', 
    frameColor: '#ffffff', 
    framePattern: 'clean', 
    customText: '',
    showDate: true,
    stickers: [], 
    capturedPhotos: [], 
    isCapturing: false,
    useMockCamera: false,
    mockCameraIntervalId: null
  };

  // --- DOM ELEMENTS ---
  const videoFeed = document.getElementById('video-feed');
  const videoViewport = document.getElementById('video-viewport');
  const videoInnerWrap = videoViewport.querySelector('.video-inner-wrap');
  const filterOverlay = document.getElementById('filter-overlay');
  const grainOverlay = document.getElementById('grain-overlay');
  const gridOverlay = document.getElementById('grid-overlay');
  const liveStickersContainer = document.getElementById('live-stickers-container');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');
  const flashOverlay = document.getElementById('flash-overlay');
  const captureProgressBar = document.getElementById('capture-progress-bar');

  // Create offscreen grain pattern for high resolution rendering
  let grainPatternCanvas = null;
  function initGrainPattern() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 128;
    pCanvas.height = 128;
    const pCtx = pCanvas.getContext('2d');
    const imgData = pCtx.createImageData(128, 128);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      data[i] = val;     // R
      data[i+1] = val;   // G
      data[i+2] = val;   // B
      data[i+3] = 32;    // Alpha (grain noise density)
    }
    pCtx.putImageData(imgData, 0, 0);
    grainPatternCanvas = pCanvas;
  }
  initGrainPattern();
  
  // Controls
  const btnCapture = document.getElementById('btn-capture');
  const btnSwitchCamera = document.getElementById('btn-switch-camera');
  const btnClearStickers = document.getElementById('btn-clear-stickers');
  const cameraStatus = document.getElementById('camera-status');
  const frameCustomText = document.getElementById('frame-custom-text');
  const showDateCheckbox = document.getElementById('show-date-checkbox');

  // Modal
  const resultModal = document.getElementById('result-modal');
  const resultImage = document.getElementById('result-image');
  const btnDownloadImage = document.getElementById('btn-download-image');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnRetake = document.getElementById('btn-retake');

  // Sounds
  const soundShutter = document.getElementById('sound-shutter');
  const soundCountdown = document.getElementById('sound-countdown');
  const soundTada = document.getElementById('sound-tada');

  // --- EVENT LISTENERS ---

  // Control Panel Tabs Switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // Layout selection
  const layoutCards = document.querySelectorAll('.layout-selection .option-card');
  layoutCards.forEach(card => {
    card.addEventListener('click', () => {
      layoutCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.layout = card.getAttribute('data-layout');
      
      // Update viewport aspect ratio based on layout preview helper
      updateViewportAspectRatio();
      // Render layout slots immediately
      renderLiveLayoutSlots();
    });
  });

  // Filter selection & categories
  const filterCards = document.querySelectorAll('.filter-selection .option-card');
  const categoryBtns = document.querySelectorAll('.filter-categories .category-btn');

  // Filter category selection
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.getAttribute('data-category');

      filterCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        // Always show original/normal filter, otherwise filter by category
        if (category === 'all' || cardCategory === category || card.getAttribute('data-filter') === 'normal') {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Filter card click selection
  filterCards.forEach(card => {
    card.addEventListener('click', () => {
      filterCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.filter = card.getAttribute('data-filter');
      
      // Apply CSS class filter to feed
      applyFilterToFeed();
    });
  });

  // Frame Color selection
  const colorBtns = document.querySelectorAll('.color-options .color-btn');
  const customFrameColorInput = document.getElementById('custom-frame-color');
  const btnCustomColor = document.getElementById('btn-custom-color');
  const patternCards = document.querySelectorAll('.pattern-selection .option-card');

  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'btn-custom-color') return; // Handled by color input

      colorBtns.forEach(b => b.classList.remove('active'));
      if (btnCustomColor) btnCustomColor.classList.remove('active');
      btn.classList.add('active');
      state.frameColor = btn.getAttribute('data-color');
      updateLiveFramePreview();
    });
  });

  // Custom Color Input Listener
  if (customFrameColorInput) {
    customFrameColorInput.addEventListener('input', (e) => {
      state.frameColor = e.target.value;
      state.framePattern = 'clean'; // Reset pattern when picking custom color
      
      colorBtns.forEach(b => b.classList.remove('active'));
      patternCards.forEach(c => c.classList.remove('active'));
      
      if (btnCustomColor) {
        btnCustomColor.style.background = e.target.value;
        btnCustomColor.classList.add('active');
      }
      
      updateLiveFramePreview();
    });
  }

  // Frame Pattern selection
  patternCards.forEach(card => {
    card.addEventListener('click', () => {
      patternCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.framePattern = card.getAttribute('data-pattern');
      updateLiveFramePreview();
    });
  });

  // Frame text input & date
  frameCustomText.addEventListener('input', (e) => {
    state.customText = e.target.value;
    updateLiveFrameTexts();
  });

  showDateCheckbox.addEventListener('change', (e) => {
    state.showDate = e.target.checked;
    updateLiveFrameTexts();
  });

  // Stickers selection click
  const stickerBtns = document.querySelectorAll('.sticker-btn-item');
  stickerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-sticker');
      addStickerToLivePreview(emoji);
    });
  });

  btnClearStickers.addEventListener('click', () => {
    state.stickers = [];
    liveStickersContainer.innerHTML = '';
  });

  // Camera settings actions (btnToggleGrid removed per user request)

  btnSwitchCamera.addEventListener('click', () => {
    toggleCameraFacingMode();
  });

  btnCapture.addEventListener('click', () => {
    if (state.isCapturing) return;
    startCaptureSequence();
  });

  // Modal Actions
  btnCloseModal.addEventListener('click', hideResultModal);
  btnRetake.addEventListener('click', hideResultModal);

  // --- CAMERA UTILITIES ---

  // Initialize Camera
  async function initCamera() {
    // Stop any existing stream
    stopCameraStream();

    const constraints = {
      audio: false,
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1440 }
      }
    };

    try {
      state.stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoFeed.srcObject = state.stream;
      state.useMockCamera = false;
      
      // Update UI Status
      cameraStatus.classList.add('connected');
      cameraStatus.innerHTML = `
        <span class="status-dot"></span>
        Kamera Siap (${state.facingMode === 'user' ? 'Depan' : 'Belakang'})
      `;
      btnSwitchCamera.disabled = false;
    } catch (err) {
      console.warn("Gagal mengakses kamera fisik. Mengaktifkan simulator kamera estetis.", err);
      setupMockCamera();
    }
  }

  function stopCameraStream() {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      state.stream = null;
    }
    if (state.mockCameraIntervalId) {
      clearInterval(state.mockCameraIntervalId);
      state.mockCameraIntervalId = null;
    }
  }

  // Toggle Front/Back Camera
  function toggleCameraFacingMode() {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    initCamera();
  }

  // Setup Mock Camera Simulator (when webcam is blocked or unavailable)
  function setupMockCamera() {
    state.useMockCamera = true;
    cameraStatus.classList.add('connected');
    cameraStatus.innerHTML = `
      <span class="status-dot" style="background-color: #eab308; box-shadow: 0 0 8px #eab308;"></span>
      Demo Mode (Simulator Kamera)
    `;

    // Create dynamic simulator: draw canvas graphics to visual element, or just show a nice placeholder
    videoFeed.style.display = 'none';
    
    // Remove old mock canvases if any
    const oldCanvas = document.getElementById('mock-camera-canvas');
    if (oldCanvas) oldCanvas.remove();

    // Create canvas matching video dimensions
    const mockCanvas = document.createElement('canvas');
    mockCanvas.id = 'mock-camera-canvas';
    mockCanvas.style.width = '100%';
    mockCanvas.style.height = '100%';
    mockCanvas.style.objectFit = 'cover';
    mockCanvas.style.transform = 'scaleX(-1)';
    videoInnerWrap.insertBefore(mockCanvas, videoFeed);

    const ctx = mockCanvas.getContext('2d');
    
    // Set internal resolution
    mockCanvas.width = 640;
    mockCanvas.height = 480;

    let hue = 0;
    
    // Animate beautiful floating neon bubbles inside the mock camera
    function drawMockFrame() {
      if (!state.useMockCamera) return;

      // Draw dark background gradient
      const grad = ctx.createLinearGradient(0, 0, mockCanvas.width, mockCanvas.height);
      grad.addColorStop(0, '#100b26');
      grad.addColorStop(1, '#070510');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, mockCanvas.width, mockCanvas.height);

      // Draw aesthetic overlay grid
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < mockCanvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mockCanvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < mockCanvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mockCanvas.width, y);
        ctx.stroke();
      }

      // Draw animated gradient circles (representing glowing lights)
      hue = (hue + 0.5) % 360;
      
      // Circle 1
      const cx1 = mockCanvas.width / 2 + Math.sin(Date.now() / 1500) * 120;
      const cy1 = mockCanvas.height / 2 + Math.cos(Date.now() / 2000) * 80;
      const r1 = 100 + Math.sin(Date.now() / 1000) * 20;
      const circleGrad1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, r1);
      circleGrad1.addColorStop(0, `hsla(${hue}, 80%, 65%, 0.45)`);
      circleGrad1.addColorStop(1, 'transparent');
      ctx.fillStyle = circleGrad1;
      ctx.beginPath();
      ctx.arc(cx1, cy1, r1, 0, Math.PI * 2);
      ctx.fill();

      // Circle 2
      const cx2 = mockCanvas.width / 2 + Math.cos(Date.now() / 1200) * 150;
      const cy2 = mockCanvas.height / 2 + Math.sin(Date.now() / 1800) * 90;
      const r2 = 90 + Math.cos(Date.now() / 800) * 15;
      const circleGrad2 = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, r2);
      circleGrad2.addColorStop(0, `hsla(${(hue + 180) % 360}, 80%, 60%, 0.45)`);
      circleGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = circleGrad2;
      ctx.beginPath();
      ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
      ctx.fill();

      // Draw face outline or camera symbol to look like a camera
      ctx.font = '24px Outfit';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('✨ Mode Demo / Kamera Aktif ✨', mockCanvas.width / 2, mockCanvas.height / 2 - 20);
      
      ctx.font = '14px Outfit';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('Gerak, pilih filter, & stiker tetap bekerja!', mockCanvas.width / 2, mockCanvas.height / 2 + 15);
      
      // Draw smiley face for simulator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(mockCanvas.width / 2, mockCanvas.height / 2 + 70, 25, 0, Math.PI, false); // Smile
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(mockCanvas.width / 2 - 12, mockCanvas.height / 2 + 55, 4, 0, Math.PI * 2); // Left eye
      ctx.arc(mockCanvas.width / 2 + 12, mockCanvas.height / 2 + 55, 4, 0, Math.PI * 2); // Right eye
      ctx.fill();
    }

    state.mockCameraIntervalId = setInterval(drawMockFrame, 1000 / 30); // 30 FPS
  }

  // Set view aspect ratio based on active layout (now applied on videoInnerWrap)
  function updateViewportAspectRatio() {
    videoInnerWrap.style.transition = 'aspect-ratio 0.4s ease';
    
    if (state.layout === 'polaroid-single') {
      videoInnerWrap.style.aspectRatio = '1 / 1';
    } else {
      // All other layout grids fit inside a standard 4:3 preview area
      videoInnerWrap.style.aspectRatio = '4 / 3';
    }
  }

  // Update Live Frame background, patterns, and spacing
  function updateLiveFramePreview() {
    // Reset background styles and preview classes
    videoViewport.style.background = '';
    videoViewport.style.backgroundColor = '';
    videoViewport.className = 'video-container';
    
    // Check if frame pattern is selected
    if (state.framePattern !== 'clean') {
      videoViewport.classList.add(`pattern-${state.framePattern}-preview`);
    } else {
      // White/Color/Custom frame layout
      if (state.frameColor === 'gradient-neon') {
        videoViewport.style.background = 'linear-gradient(135deg, #ff007f, #7f00ff, #06b6d4)';
      } else {
        videoViewport.style.backgroundColor = state.frameColor;
      }
    }
    
    // Always apply has-frame layout
    videoViewport.classList.add('has-frame');
    
    // Set text class coloring based on dark or light backgrounds
    const isDarkFrame = (state.frameColor === '#111111' || state.frameColor === 'gradient-neon' || state.framePattern === 'film-strip' || state.framePattern === 'cyber-grid');
    if (isDarkFrame) {
      videoViewport.classList.add('dark-frame');
    } else {
      videoViewport.classList.remove('dark-frame');
    }
  }

  // Update Live Frame texts (polaroid custom writing)
  function updateLiveFrameTexts() {
    const liveTextEl = document.getElementById('live-frame-text');
    const liveDateEl = document.getElementById('live-frame-date');
    
    if (state.customText.trim() !== '') {
      liveTextEl.textContent = state.customText.toUpperCase();
    } else {
      liveTextEl.textContent = 'SNAPAESTHETIC ✨';
    }
    
    if (state.showDate) {
      const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
      liveDateEl.textContent = new Date().toLocaleDateString('id-ID', options);
      liveDateEl.style.display = 'block';
    } else {
      liveDateEl.style.display = 'none';
    }
  }

  // Get total photos needed for layout
  function getTotalPhotosNeeded() {
    switch (state.layout) {
      case 'strip-4': return 4;
      case 'strip-3': return 3;
      case 'strip-2': return 2;
      case 'grid-2x2': return 4;
      case 'grid-3x2': return 6;
      case 'wide-double': return 2;
      case 'polaroid-single':
      case 'landscape-single':
      default:
        return 1;
    }
  }

  // Render layout slots inside videoInnerWrap
  function renderLiveLayoutSlots() {
    const layoutGrid = document.getElementById('live-layout-grid');
    if (!layoutGrid) return;
    
    layoutGrid.innerHTML = '';
    layoutGrid.className = `live-layout-grid layout-${state.layout}`;
    
    const totalSlots = getTotalPhotosNeeded();
    
    for (let i = 0; i < totalSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'photo-slot';
      slot.setAttribute('data-slot-index', i);
      
      if (i === 0) {
        slot.classList.add('active-feed');
        slot.appendChild(videoFeed);
        
        const mockCanvas = document.getElementById('mock-camera-canvas');
        if (mockCanvas) {
          slot.appendChild(mockCanvas);
        }
        
        slot.appendChild(filterOverlay);
        slot.appendChild(grainOverlay);
        
        const countdownOverlay = document.getElementById('countdown-overlay');
        if (countdownOverlay) slot.appendChild(countdownOverlay);
        
        const flashOverlay = document.getElementById('flash-overlay');
        if (flashOverlay) slot.appendChild(flashOverlay);
      } else {
        slot.innerHTML = `
          <div class="slot-placeholder">
            <i data-lucide="camera" class="placeholder-icon"></i>
            <span>Slot ${i + 1}</span>
          </div>
        `;
      }
      layoutGrid.appendChild(slot);
    }
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Apply visual CSS filter to preview
  function applyFilterToFeed() {
    // Remove all previous filters, vignettes and grain
    filterOverlay.className = 'filter-overlay';
    grainOverlay.className = 'grain-overlay';
    grainOverlay.style.opacity = '0';
    
    if (state.filter !== 'normal') {
      filterOverlay.classList.add(`filter-${state.filter}-effect`);
      
      // If it is a LOMO filter, add vignette class
      if (state.filter.startsWith('lomo')) {
        filterOverlay.classList.add('vignette-effect');
      }
      
      // If it is a GRAIN filter, enable grain overlay with custom opacities
      if (state.filter.startsWith('grain')) {
        grainOverlay.classList.add('active');
        // Define different grain opacity weights
        let opacity = '0.15';
        if (state.filter === 'grain02') opacity = '0.24'; // Heavy Matte
        if (state.filter === 'grain03') opacity = '0.3';  // B&W Coarse
        if (state.filter === 'grain04') opacity = '0.2';
        if (state.filter === 'grain05') opacity = '0.18';
        if (state.filter === 'grain06') opacity = '0.1';  // Cinematic Soft
        grainOverlay.style.opacity = opacity;
      }
    }
  }

  // --- STICKERS MANAGEMENT ---

  function addStickerToLivePreview(emoji) {
    const stickerId = 'sticker-' + Date.now();
    const stickerEl = document.createElement('div');
    stickerEl.className = 'draggable-sticker';
    stickerEl.id = stickerId;
    
    // Center of viewport initially
    const rect = videoViewport.getBoundingClientRect();
    const initX = (rect.width / 2) - 30;
    const initY = (rect.height / 2) - 30;

    stickerEl.style.left = `${initX}px`;
    stickerEl.style.top = `${initY}px`;
    
    stickerEl.innerHTML = `
      <span class="sticker-content">${emoji}</span>
      <button class="sticker-delete-btn">&times;</button>
    `;

    liveStickersContainer.appendChild(stickerEl);

    // Save to state
    const stickerObj = {
      id: stickerId,
      emoji: emoji,
      x: initX,
      y: initY,
      size: 56 // standard size in px (matches 3.5rem)
    };
    state.stickers.push(stickerObj);

    // Make it Draggable
    setupDraggable(stickerEl, stickerObj);

    // Delete sticker action
    stickerEl.querySelector('.sticker-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      stickerEl.remove();
      state.stickers = state.stickers.filter(s => s.id !== stickerId);
    });
  }

  // Custom Touch/Mouse Drag Handler
  function setupDraggable(element, obj) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    element.addEventListener('mousedown', dragMouseDown);
    element.addEventListener('touchstart', dragTouchStart, { passive: false });

    function dragMouseDown(e) {
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
    }

    function dragTouchStart(e) {
      // get touch position
      const touch = e.touches[0];
      pos3 = touch.clientX;
      pos4 = touch.clientY;
      document.addEventListener('touchend', closeDragElement);
      document.addEventListener('touchmove', elementTouchDrag, { passive: false });
    }

    function elementDrag(e) {
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      performMove(element.offsetLeft - pos1, element.offsetTop - pos2);
    }

    function elementTouchDrag(e) {
      e.preventDefault();
      const touch = e.touches[0];
      pos1 = pos3 - touch.clientX;
      pos2 = pos4 - touch.clientY;
      pos3 = touch.clientX;
      pos4 = touch.clientY;

      performMove(element.offsetLeft - pos1, element.offsetTop - pos2);
    }

    function performMove(newX, newY) {
      const containerRect = videoViewport.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Constraint inside container
      const maxX = containerRect.width - elementRect.width;
      const maxY = containerRect.height - elementRect.height;
      
      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));

      element.style.left = `${clampedX}px`;
      element.style.top = `${clampedY}px`;

      // Update state coordinates
      obj.x = clampedX;
      obj.y = clampedY;
    }

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
      document.removeEventListener('touchend', closeDragElement);
      document.removeEventListener('touchmove', elementTouchDrag);
    }
  }

  // --- CAPTURE SEQUENCE LOGIC ---

  async function startCaptureSequence() {
    state.isCapturing = true;
    state.capturedPhotos = [];
    btnCapture.disabled = true;
    btnSwitchCamera.disabled = true;
    
    // Determine number of photos based on layout
    const totalPhotosNeeded = getTotalPhotosNeeded();

    // Reset progress step classes and build steps
    captureProgressBar.innerHTML = '';
    for (let i = 0; i < totalPhotosNeeded; i++) {
      const step = document.createElement('div');
      step.className = 'progress-step';
      step.setAttribute('data-step', i + 1);
      captureProgressBar.appendChild(step);
    }
    
    const steps = captureProgressBar.querySelectorAll('.progress-step');
    if (totalPhotosNeeded > 1) {
      captureProgressBar.classList.add('active');
    }

    // Reset layout slots
    renderLiveLayoutSlots();

    for (let i = 0; i < totalPhotosNeeded; i++) {
      // Focus current step progress bar
      if (totalPhotosNeeded > 1 && i < steps.length) {
        steps[i].className = 'progress-step done';
      }

      // Countdown
      await runCountdown(3);

      // Shutter Trigger
      triggerFlashEffect();
      playSound(soundShutter);
      
      // Capture frame
      const frameData = captureFrame();
      state.capturedPhotos.push(frameData);

      // Render the captured photo in slot i
      const activeSlot = videoViewport.querySelector(`.photo-slot[data-slot-index="${i}"]`);
      if (activeSlot) {
        activeSlot.classList.remove('active-feed');
        activeSlot.innerHTML = '';
        const img = document.createElement('img');
        img.src = frameData;
        activeSlot.appendChild(img);
      }

      // Move feed to slot i+1 if there is a next slot
      if (i + 1 < totalPhotosNeeded) {
        const nextSlot = videoViewport.querySelector(`.photo-slot[data-slot-index="${i + 1}"]`);
        if (nextSlot) {
          nextSlot.innerHTML = '';
          nextSlot.classList.add('active-feed');
          nextSlot.appendChild(videoFeed);
          const mockCanvas = document.getElementById('mock-camera-canvas');
          if (mockCanvas) {
            nextSlot.appendChild(mockCanvas);
          }
          nextSlot.appendChild(filterOverlay);
          nextSlot.appendChild(grainOverlay);
          
          const countdownOverlay = document.getElementById('countdown-overlay');
          if (countdownOverlay) nextSlot.appendChild(countdownOverlay);
          
          const flashOverlay = document.getElementById('flash-overlay');
          if (flashOverlay) nextSlot.appendChild(flashOverlay);
        }
      }

      // Wait brief moment before next shot (for visual pacing)
      await sleep(800);
    }

    // Capture complete
    captureProgressBar.classList.remove('active');
    playSound(soundTada);
    
    // Render and show in modal
    await compileAndExportHDPhoto();
    
    // Enable Capture Buttons again
    state.isCapturing = false;
    btnCapture.disabled = false;
    btnSwitchCamera.disabled = !state.useMockCamera;
  }

  // Helper promise sleep
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Countdown controller
  function runCountdown(seconds) {
    return new Promise((resolve) => {
      countdownOverlay.classList.add('active');
      let count = seconds;
      countdownNumber.textContent = count;
      playSound(soundCountdown);

      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          countdownNumber.textContent = count;
          playSound(soundCountdown);
        } else {
          clearInterval(interval);
          countdownOverlay.classList.remove('active');
          resolve();
        }
      }, 1000);
    });
  }

  // Trigger flash overlay animation
  function triggerFlashEffect() {
    flashOverlay.classList.remove('trigger');
    // trigger reflow to reset animation
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add('trigger');
  }

  // Sound Player
  function playSound(audioEl) {
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(e => console.log('Audio autoplay blocked or failed:', e));
    }
  }

  // Capture current video / mock frame
  function captureFrame() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let sourceWidth = 0;
    let sourceHeight = 0;
    
    if (state.useMockCamera) {
      const mockCanvas = document.getElementById('mock-camera-canvas');
      sourceWidth = mockCanvas.width;
      sourceHeight = mockCanvas.height;
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      // Draw mirrored mock feed
      ctx.drawImage(mockCanvas, 0, 0);
    } else {
      sourceWidth = videoFeed.videoWidth;
      sourceHeight = videoFeed.videoHeight;
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      
      // Draw video frame to canvas
      ctx.drawImage(videoFeed, 0, 0, sourceWidth, sourceHeight);
    }

    // Crop to 1:1 if polaroid mode is active
    if (state.layout === 'polaroid-single') {
      const squareSize = Math.min(sourceWidth, sourceHeight);
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = squareSize;
      cropCanvas.height = squareSize;
      
      const cropCtx = cropCanvas.getContext('2d');
      const startX = (sourceWidth - squareSize) / 2;
      const startY = (sourceHeight - squareSize) / 2;
      
      cropCtx.drawImage(canvas, startX, startY, squareSize, squareSize, 0, 0, squareSize, squareSize);
      return cropCanvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
  }

  // --- CANVAS HD COMPILER & DOWNLOAD ---

  // Compile photos, frames, filters, and text to high resolution
  function compileAndExportHDPhoto() {
    return new Promise((resolve) => {
      const canvas = document.getElementById('hd-render-canvas');
      const ctx = canvas.getContext('2d');

      // Define standard high-resolution output bounds
      let canvasWidth = 1200;
      let canvasHeight = 1800;

      // Adjust size and grids depending on layouts
      if (state.layout === 'strip-4') {
        canvasWidth = 1200;
        canvasHeight = 3800;
      } else if (state.layout === 'strip-3') {
        canvasWidth = 1200;
        canvasHeight = 2900;
      } else if (state.layout === 'strip-2') {
        canvasWidth = 1200;
        canvasHeight = 2000;
      } else if (state.layout === 'grid-2x2') {
        canvasWidth = 2000;
        canvasHeight = 2200;
      } else if (state.layout === 'grid-3x2') {
        canvasWidth = 2000;
        canvasHeight = 3100;
      } else if (state.layout === 'wide-double') {
        canvasWidth = 2200;
        canvasHeight = 1200;
      } else if (state.layout === 'polaroid-single') {
        canvasWidth = 1600;
        canvasHeight = 2000;
      } else if (state.layout === 'landscape-single') {
        canvasWidth = 2400;
        canvasHeight = 2000;
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // 1. Draw Frame background color or gradient
      if (state.framePattern === 'film-strip') {
        ctx.fillStyle = '#111111'; // Force black background for classic film roll
      } else if (state.framePattern === 'newspaper') {
        ctx.fillStyle = '#f3ebd9'; // Force creamy vintage newsprint color
      } else if (state.frameColor === 'gradient-neon') {
        const bgGrad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        bgGrad.addColorStop(0, '#ff007f');
        bgGrad.addColorStop(0.5, '#ab00ff');
        bgGrad.addColorStop(1, '#06b6d4');
        ctx.fillStyle = bgGrad;
      } else {
        ctx.fillStyle = state.frameColor;
      }
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 2. Draw Frame Patterns/Themes
      drawFramePatternDecoration(ctx, canvasWidth, canvasHeight);

      // 3. Draw Photos
      const imagesLoaded = [];
      let loadedCount = 0;

      state.capturedPhotos.forEach((dataUrl, index) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          imagesLoaded[index] = img;
          loadedCount++;
          if (loadedCount === state.capturedPhotos.length) {
            drawAllPhotosAndStickers(ctx, canvas, imagesLoaded);
            
            // 4. Draw Date and Custom Text
            drawFrameTexts(ctx, canvasWidth, canvasHeight);
            
            // Show modal
            const exportedDataURL = canvas.toDataURL('image/png', 1.0);
            resultImage.src = exportedDataURL;
            btnDownloadImage.href = exportedDataURL;
            
            // Set cute dynamic file name
            const todayStr = new Date().toISOString().slice(0, 10);
            btnDownloadImage.download = `snap-aesthetic-${todayStr}-${Date.now()}.png`;

            showResultModal();
            resolve();
          }
        };
      });
    });
  }

  // Draw pattern decorations on the canvas frame
  function drawFramePatternDecoration(ctx, width, height) {
    if (state.framePattern === 'clean') return;

    ctx.save();

    if (state.framePattern === 'cute-heart') {
      // Draw lovely scattered hearts
      ctx.fillStyle = 'rgba(255, 80, 150, 0.4)';
      const heartCount = 35;
      for (let i = 0; i < heartCount; i++) {
        // Pseudo-random coordinates using simple seed to keep rendering deterministic for same actions
        const x = (Math.abs(Math.sin(i * 123.45)) * width);
        const y = (Math.abs(Math.cos(i * 543.21)) * height);
        const size = 15 + (Math.abs(Math.sin(i * 99)) * 25);
        drawHeartShape(ctx, x, y, size);
      }
    } 
    else if (state.framePattern === 'retro-stars') {
      // Draw retro sparkles / 4-pointed stars
      ctx.fillStyle = 'rgba(255, 215, 0, 0.45)';
      const starCount = 40;
      for (let i = 0; i < starCount; i++) {
        const x = (Math.abs(Math.sin(i * 65.43)) * width);
        const y = (Math.abs(Math.cos(i * 23.45)) * height);
        const size = 10 + (Math.abs(Math.sin(i * 77)) * 20);
        drawStarShape(ctx, x, y, size);
      }
    } 
    else if (state.framePattern === 'cyber-grid') {
      // Draw cyber neon grids
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 2;
      const step = 60;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    else if (state.framePattern === 'film-strip') {
      // Draw sprocket holes along left & right margins
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // scanner light sprocket hole color
      const sprocketW = 28;
      const sprocketH = 42;
      const borderRadius = 6;
      const gap = 80;

      for (let y = 30; y < height - 30; y += gap) {
        // Left sprocket hole
        drawRoundedRect(ctx, 28, y, sprocketW, sprocketH, borderRadius);
        // Right sprocket hole
        drawRoundedRect(ctx, width - 28 - sprocketW, y, sprocketW, sprocketH, borderRadius);
      }

      // Draw Kodak retro orange/yellow film labels
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 16px "Outfit", monospace';
      ctx.textAlign = 'center';

      for (let y = 180; y < height - 150; y += 600) {
        ctx.save();
        // Left side vertical text: KODAK PORTRA 400
        ctx.translate(16, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('KODAK PORTRA 400', 0, 0);
        ctx.restore();

        ctx.save();
        // Right side vertical text: ▶ 01A
        ctx.translate(width - 16, y + 120);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(`▶ CLY ${Math.floor(y/240) + 1}A`, 0, 0);
        ctx.restore();
      }

      // Draw retro film edge frame markings (dusty look)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.font = '10px sans-serif';
      ctx.fillText('🎞️ ISO 400', 70, 22);
      ctx.fillText('SAFETY FILM', width / 2, 22);
      ctx.fillText('24 Exp', width - 70, 22);
    }
    else if (state.framePattern === 'newspaper') {
      // 1. Newspaper Headline Banner
      ctx.fillStyle = '#1c1b18'; // news ink
      ctx.textAlign = 'center';
      
      // Giant bold title
      ctx.font = 'bold 50px "Playfair Display", Georgia, serif';
      ctx.fillText('THE DAILY MEMORIES', width / 2, 70);
      
      // Horizontal dividers
      ctx.strokeStyle = '#1c1b18';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(35, 92);
      ctx.lineTo(width - 35, 92);
      ctx.stroke();
      
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, 99);
      ctx.lineTo(width - 35, 99);
      ctx.stroke();
      
      // Meta headers: issue number, weather, date
      ctx.font = 'bold 13px "Outfit", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('VOL. XCVI... NO. 2026', 45, 118);
      ctx.textAlign = 'right';
      ctx.fillText('WEATHER: SUNNY & CUTE', width - 45, 118);
      ctx.textAlign = 'center';
      ctx.fillText('EST. 2026 • RETRO GAZETTE', width / 2, 118);
      
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(35, 126);
      ctx.lineTo(width - 35, 126);
      ctx.stroke();

      // 2. Barcode & Stamp at the bottom
      const barcodeX = width - 200;
      const barcodeY = height - 125;
      for (let b = 0; b < 25; b++) {
        const w = 2 + Math.floor(Math.abs(Math.sin(b * 45)) * 6);
        const spacing = 2 + Math.floor(Math.abs(Math.cos(b * 12)) * 4);
        ctx.fillRect(barcodeX + b * (w + spacing), barcodeY, w, 55);
      }
      ctx.font = '10px monospace';
      ctx.fillText('0 12345 67890 5', barcodeX + 60, barcodeY + 68);

      // RED STAMP "APPROVED"
      ctx.save();
      ctx.strokeStyle = 'rgba(190, 24, 24, 0.75)'; // retro ink red
      ctx.lineWidth = 4;
      ctx.font = 'bold 26px "Outfit"';
      ctx.translate(140, height - 110);
      ctx.rotate(-0.15);
      // Stamp boundary box
      ctx.strokeRect(-12, -28, 195, 42);
      ctx.fillStyle = 'rgba(190, 24, 24, 0.75)';
      ctx.fillText('AESTHETIC OK', 0, 0);
      ctx.restore();

      // Little column lines on the sides to mimic articles
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(35, 140); ctx.lineTo(35, height - 150);
      ctx.moveTo(width - 35, 140); ctx.lineTo(width - 35, height - 150);
      ctx.stroke();
    }
    else if (state.framePattern === 'y2k-stickers') {
      // Draw gradient background in canvas
      const y2kGrad = ctx.createLinearGradient(0, 0, width, height);
      y2kGrad.addColorStop(0, '#ff7beb');
      y2kGrad.addColorStop(1, '#7beaff');
      ctx.fillStyle = y2kGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw cyber 4-pointed stars
      ctx.fillStyle = '#ffffff';
      const starCoords = [
        { x: 80, y: 150, size: 25 },
        { x: width - 90, y: 350, size: 20 },
        { x: 90, y: height - 300, size: 18 },
        { x: width - 110, y: height - 180, size: 22 }
      ];
      starCoords.forEach(star => {
        drawStarShape(ctx, star.x, star.y, star.size);
      });

      // Draw retro Win95-style warning window
      const winX = 60;
      const winY = height - 120;
      ctx.fillStyle = '#e2e8f0'; // solid retro gray
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.fillRect(winX, winY, 280, 80);
      ctx.strokeRect(winX, winY, 280, 80);

      // Window title bar
      ctx.fillStyle = '#0022cc'; // bright neon blue
      ctx.fillRect(winX + 2, winY + 2, 276, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(' system_error.exe', winX + 5, winY + 15);

      // Close button
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(winX + 258, winY + 3, 18, 16);
      ctx.strokeRect(winX + 258, winY + 3, 18, 16);
      ctx.fillStyle = '#000';
      ctx.fillText('×', winX + 264, winY + 15);

      // Dialog text
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px "Outfit"';
      ctx.fillText('WARNING: Cuteness overload! 🌸', winX + 12, winY + 54);
    }
    else if (state.framePattern === 'checkered') {
      ctx.fillStyle = '#e2e8f0';
      const size = 60;
      for (let y = 0; y < height; y += size * 2) {
        for (let x = 0; x < width; x += size * 2) {
          ctx.fillRect(x, y, size, size);
          ctx.fillRect(x + size, y + size, size, size);
        }
      }
    }
    else if (state.framePattern === 'gradient-sunset') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#ff9a9e');
      grad.addColorStop(0.5, '#fecfef');
      grad.addColorStop(1, '#ffc3a0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    else if (state.framePattern === 'cotton-candy') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#ffc0cb');
      grad.addColorStop(0.5, '#e0c3fc');
      grad.addColorStop(1, '#8fd3f4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    else if (state.framePattern === 'retro-floral') {
      const floralCount = 45;
      for (let i = 0; i < floralCount; i++) {
        const x = (Math.abs(Math.sin(i * 99)) * width);
        const y = (Math.abs(Math.cos(i * 123)) * height);
        const size = 30 + (Math.abs(Math.sin(i * 44)) * 40);
        drawFlowerShape(ctx, x, y, size);
      }
    }

    ctx.restore();
  }

  // Draw 5-petal daisy flower shape on canvas
  function drawFlowerShape(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    
    // Draw 5 petals
    ctx.fillStyle = '#ff922b';
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.arc(0, -size / 2, size / 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Draw center
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, size / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw rounded rect helper for sprockets
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  // Draw Heart shape helper
  function drawHeartShape(ctx, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.translate(x, y);
    ctx.moveTo(0, 0 - size / 4);
    // Left curve
    ctx.bezierCurveTo(-size / 2, -size, -size, -size / 3, 0, size);
    // Right curve
    ctx.bezierCurveTo(size, -size / 3, size / 2, -size, 0, 0 - size / 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw 4-pointed star shape helper
  function drawStarShape(ctx, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.translate(x, y);
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(0, 0, size, 0);
    ctx.quadraticCurveTo(0, 0, 0, size);
    ctx.quadraticCurveTo(0, 0, -size, 0);
    ctx.quadraticCurveTo(0, 0, 0, -size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Render photo frames inside canvas based on layout
  function drawAllPhotosAndStickers(ctx, canvas, images) {
    const W = canvas.width;
    const H = canvas.height;
    
    // Set Canvas Filter (matches UI state)
    ctx.save();
    ctx.filter = getCanvasFilterString();

    const photoBounds = []; // Store bounding boxes for stickers placing

    if (state.layout === 'strip-4') {
      // 4 Photos vertically
      const borderGap = (state.framePattern === 'film-strip' || state.framePattern === 'newspaper') ? 85 : 65; 
      const photoW = W - (borderGap * 2);
      const photoH = photoW * (3 / 4); // 4:3 ratio
      const middleGap = 40;
      const startY = (state.framePattern === 'newspaper') ? 160 : 65;
 
      for (let i = 0; i < 4; i++) {
        const py = startY + i * (photoH + middleGap);
        const px = borderGap;
        
        drawMirroredPhoto(ctx, images[i], px, py, photoW, photoH);
        photoBounds.push({ x: px, y: py, w: photoW, h: photoH });
      }
    } 
    else if (state.layout === 'strip-3') {
      // 3 Photos vertically (Classic Filmstrip)
      const borderGap = (state.framePattern === 'film-strip' || state.framePattern === 'newspaper') ? 85 : 65;
      const photoW = W - (borderGap * 2);
      const photoH = photoW * (3 / 4); // 4:3 ratio
      const middleGap = 45;
      const startY = (state.framePattern === 'newspaper') ? 160 : 80;

      for (let i = 0; i < 3; i++) {
        const py = startY + i * (photoH + middleGap);
        const px = borderGap;
        
        drawMirroredPhoto(ctx, images[i], px, py, photoW, photoH);
        photoBounds.push({ x: px, y: py, w: photoW, h: photoH });
      }
    } 
    else if (state.layout === 'grid-2x2') {
      // 2x2 grid
      const borderGap = 65;
      const gap = 45;
      const photoW = (W - (borderGap * 2) - gap) / 2;
      const photoH = photoW * (3 / 4); // 4:3
      const startY = (state.framePattern === 'newspaper') ? 165 : 80;
      
      // Photo 1
      drawMirroredPhoto(ctx, images[0], borderGap, startY, photoW, photoH);
      photoBounds.push({ x: borderGap, y: startY, w: photoW, h: photoH });

      // Photo 2
      drawMirroredPhoto(ctx, images[1], borderGap + photoW + gap, startY, photoW, photoH);
      photoBounds.push({ x: borderGap + photoW + gap, y: startY, w: photoW, h: photoH });

      // Photo 3
      drawMirroredPhoto(ctx, images[2], borderGap, startY + photoH + gap, photoW, photoH);
      photoBounds.push({ x: borderGap, y: startY + photoH + gap, w: photoW, h: photoH });

      // Photo 4
      drawMirroredPhoto(ctx, images[3], borderGap + photoW + gap, startY + photoH + gap, photoW, photoH);
      photoBounds.push({ x: borderGap + photoW + gap, y: startY + photoH + gap, w: photoW, h: photoH });
    } 
    else if (state.layout === 'strip-2') {
      // 2 Photos vertically
      const borderGap = (state.framePattern === 'film-strip' || state.framePattern === 'newspaper') ? 85 : 65;
      const photoW = W - (borderGap * 2);
      const photoH = photoW * (3 / 4); // 4:3
      const middleGap = 45;
      const startY = (state.framePattern === 'newspaper') ? 160 : 80;

      for (let i = 0; i < 2; i++) {
        const py = startY + i * (photoH + middleGap);
        const px = borderGap;
        
        drawMirroredPhoto(ctx, images[i], px, py, photoW, photoH);
        photoBounds.push({ x: px, y: py, w: photoW, h: photoH });
      }
    }
    else if (state.layout === 'grid-3x2') {
      // 6 Photos: 3 rows, 2 columns grid
      const borderGap = 65;
      const gap = 45;
      const photoW = (W - (borderGap * 2) - gap) / 2;
      const photoH = photoW * (3 / 4);
      const startY = (state.framePattern === 'newspaper') ? 165 : 80;

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const idx = row * 2 + col;
          const px = borderGap + col * (photoW + gap);
          const py = startY + row * (photoH + gap);
          
          drawMirroredPhoto(ctx, images[idx], px, py, photoW, photoH);
          photoBounds.push({ x: px, y: py, w: photoW, h: photoH });
        }
      }
    }
    else if (state.layout === 'wide-double') {
      // 2 horizontal side-by-side
      const borderGap = 65;
      const gap = 45;
      const photoW = (W - (borderGap * 2) - gap) / 2;
      const photoH = photoW * (3 / 4);
      const startY = (state.framePattern === 'newspaper') ? 165 : 80;

      drawMirroredPhoto(ctx, images[0], borderGap, startY, photoW, photoH);
      photoBounds.push({ x: borderGap, y: startY, w: photoW, h: photoH });

      drawMirroredPhoto(ctx, images[1], borderGap + photoW + gap, startY, photoW, photoH);
      photoBounds.push({ x: borderGap + photoW + gap, y: startY, w: photoW, h: photoH });
    }
    else if (state.layout === 'polaroid-single') {
      // Square polaroid (1:1 aspect ratio photo)
      const borderGap = 80;
      const photoW = W - (borderGap * 2);
      const photoH = photoW; // 1:1
      const startY = (state.framePattern === 'newspaper') ? 170 : 80;

      drawMirroredPhoto(ctx, images[0], borderGap, startY, photoW, photoH);
      photoBounds.push({ x: borderGap, y: startY, w: photoW, h: photoH });
    } 
    else if (state.layout === 'landscape-single') {
      // Wide single 4:3
      const borderGap = 90;
      const photoW = W - (borderGap * 2);
      const photoH = photoW * (3 / 4);
      const startY = (state.framePattern === 'newspaper') ? 170 : 90;

      drawMirroredPhoto(ctx, images[0], borderGap, startY, photoW, photoH);
      photoBounds.push({ x: borderGap, y: startY, w: photoW, h: photoH });
    }

    ctx.restore(); // Restore filter state back to normal for texts and stickers

    // Draw Grain on each photo if a grain filter is active
    if (state.filter.startsWith('grain')) {
      let opacity = 0.12;
      if (state.filter === 'grain02') opacity = 0.20;
      if (state.filter === 'grain03') opacity = 0.25;
      if (state.filter === 'grain04') opacity = 0.16;
      if (state.filter === 'grain05') opacity = 0.14;
      if (state.filter === 'grain06') opacity = 0.08;
      
      photoBounds.forEach(bound => {
        drawGrainOnPhoto(ctx, bound.x, bound.y, bound.w, bound.h, opacity);
      });
    }

    // Draw Vignette on each photo if a lomo filter is active
    if (state.filter.startsWith('lomo')) {
      photoBounds.forEach(bound => {
        drawVignetteOnPhoto(ctx, bound.x, bound.y, bound.w, bound.h);
      });
    }

    // 5. Draw Stickers onto the Canvas relative to the entire outer canvas frame
    drawStickersOnCanvas(ctx, W, H);
  }

  // Draw Grain pattern inside a specific photo boundary on high-res canvas
  function drawGrainOnPhoto(ctx, x, y, width, height, opacity) {
    if (!grainPatternCanvas) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = 'overlay';
    const pattern = ctx.createPattern(grainPatternCanvas, 'repeat');
    ctx.fillStyle = pattern;
    ctx.translate(x, y); // Start tiling relative to photo coordinate
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Draw radial vignette inside a specific photo boundary on high-res canvas
  function drawVignetteOnPhoto(ctx, x, y, width, height) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rStart = Math.min(width, height) * 0.45;
    const rEnd = Math.max(width, height) * 0.85;
    
    const grad = ctx.createRadialGradient(cx, cy, rStart, cx, cy, rEnd);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  // Draw the image mirrored (users expect camera snaps to be mirrored like looking at a mirror)
  function drawMirroredPhoto(ctx, img, x, y, width, height) {
    ctx.save();
    // Shift coordinate system to flip horizontal axis
    ctx.translate(x + width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, y, width, height);
    ctx.restore();

    // If newspaper pattern is selected, draw a retro thin border around the photo block
    if (state.framePattern === 'newspaper') {
      ctx.save();
      ctx.strokeStyle = '#1c1b18';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }
  }

  // Apply filter to Canvas rendering using context filter property
  function getCanvasFilterString() {
    switch (state.filter) {
      // CCD
      case 'ccd01': return 'saturate(1.2) hue-rotate(5deg) contrast(1.1) brightness(1.02)';
      case 'ccd02': return 'saturate(1.15) sepia(0.18) contrast(1.08) brightness(1.03)';
      case 'ccd03': return 'brightness(1.15) contrast(0.95) saturate(1.05)';
      case 'ccd04': return 'contrast(0.85) saturate(0.85) brightness(1.08) sepia(0.08)';
      case 'ccd05': return 'contrast(1.15) saturate(1.1) hue-rotate(25deg) brightness(0.98)';
      case 'ccd06': return 'saturate(1.25) hue-rotate(-15deg) brightness(1.04) contrast(1.05)';
      case 'ccd07': return 'contrast(1.3) saturate(1.35) brightness(1.0)';
      
      // 90s
      case '90s01': return 'sepia(0.12) hue-rotate(8deg) contrast(1.08) saturate(0.95)';
      case '90s02': return 'sepia(0.4) contrast(1.1) brightness(0.98) saturate(0.85)';
      case '90s03': return 'sepia(0.2) contrast(0.9) brightness(1.05) saturate(0.8)';
      case '90s04': return 'sepia(0.1) saturate(0.8) hue-rotate(15deg) brightness(1.02) contrast(1.05)';
      case '90s05': return 'contrast(1.2) hue-rotate(110deg) saturate(1.3) brightness(0.95)';
      case '90s06': return 'sepia(0.25) saturate(1.2) contrast(1.1) brightness(1.02)';
      case '90s07': return 'opacity(0.9) contrast(0.8) brightness(1.1) saturate(0.7) sepia(0.1)';
      
      // HDR
      case 'hdr01': return 'contrast(1.25) saturate(1.2) brightness(1.05)';
      case 'hdr02': return 'contrast(1.4) saturate(1.15) brightness(0.95)';
      case 'hdr03': return 'sepia(0.3) saturate(1.4) contrast(1.15) brightness(1.05)';
      case 'hdr04': return 'contrast(1.35) saturate(1.5) hue-rotate(140deg)';
      case 'hdr05': return 'contrast(1.2) saturate(0.95) hue-rotate(-10deg) brightness(1.05)';
      case 'hdr06': return 'contrast(0.9) brightness(1.1) saturate(1.3)';
      case 'hdr07': return 'contrast(1.45) saturate(1.25) brightness(1.0)';
      
      // GRAIN
      case 'grain01': return 'contrast(1.05) brightness(1.0)';
      case 'grain02': return 'contrast(0.85) brightness(1.08) saturate(0.9) sepia(0.1)';
      case 'grain03': return 'grayscale(1) contrast(1.4) brightness(0.95)';
      case 'grain04': return 'sepia(0.25) contrast(1.1) saturate(1.15)';
      case 'grain05': return 'hue-rotate(10deg) sepia(0.1) saturate(0.9) contrast(1.05)';
      case 'grain06': return 'contrast(1.0) brightness(1.02) saturate(0.95) sepia(0.05)';
      
      // LOMO
      case 'lomo01': return 'contrast(1.3) saturate(1.4) brightness(0.98)';
      case 'lomo02': return 'contrast(1.2) saturate(1.3) hue-rotate(-15deg)';
      case 'lomo03': return 'sepia(0.2) saturate(1.15) brightness(1.05) contrast(1.05)';
      case 'lomo04': return 'saturate(1.25) contrast(1.1) brightness(1.02) sepia(0.12)';
      case 'lomo05': return 'contrast(1.25) saturate(1.2) hue-rotate(-50deg)';
      
      // COLOR
      case 'c01': return 'sepia(0.5) hue-rotate(-50deg) saturate(2.5) contrast(1.2)';
      case 'c02': return 'sepia(0.5) hue-rotate(170deg) saturate(2.2) contrast(1.1) brightness(0.95)';
      case 'c03': return 'sepia(0.5) hue-rotate(75deg) saturate(2.0) contrast(1.15)';
      case 'c04': return 'sepia(0.4) hue-rotate(30deg) saturate(2.0) contrast(1.1) brightness(1.05)';
      
      default:
        return 'none';
    }
  }

  // Translate stickers from live preview onto target canvas (drawn once on the entire canvas)
  function drawStickersOnCanvas(ctx, canvasWidth, canvasHeight) {
    if (state.stickers.length === 0) return;

    const viewportRect = videoViewport.getBoundingClientRect();
    const vw = viewportRect.width;
    const vh = viewportRect.height;

    state.stickers.forEach(sticker => {
      // Calculate relative coordinates in percentage of the outer videoViewport
      const relX = sticker.x / vw;
      const relY = sticker.y / vh;
      
      // Map directly to HD canvas dimensions
      const canvasStickerX = relX * canvasWidth;
      const canvasStickerY = relY * canvasHeight;
      
      // Scale sticker size relative to canvas width
      const sizeRatio = sticker.size / vw;
      const canvasStickerSize = sizeRatio * canvasWidth;

      ctx.save();
      ctx.font = `${canvasStickerSize}px Outfit, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add subtle shadow for stickers depth
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      ctx.fillText(sticker.emoji, canvasStickerX + (canvasStickerSize/2), canvasStickerY + (canvasStickerSize/2));
      ctx.restore();
    });
  }

  // Draw Frame Text & Current Date
  function drawFrameTexts(ctx, width, height) {
    ctx.save();
    
    // Choose text color based on frame color (white/pastel = dark text, black/gradient = light text)
    const isDarkFrame = (state.frameColor === '#111111' || state.frameColor === 'gradient-neon');
    ctx.fillStyle = isDarkFrame ? '#ffffff' : '#111111';

    // Font styles
    ctx.textAlign = 'center';
    
    let textY = height - 120; // Default spacing from bottom
    if (state.layout === 'strip-4' || state.layout === 'strip-3') {
      textY = height - 140;
    }

    // 1. Draw Custom Text
    if (state.customText.trim() !== '') {
      ctx.font = 'bold 36px "Outfit"';
      ctx.fillText(state.customText.toUpperCase(), width / 2, textY);
      textY += 50; // shift down for date
    } else {
      // Default cute brand logo text if custom text is empty
      ctx.font = 'italic 600 38px "Playfair Display"';
      ctx.fillText('SnapAesthetic ✨', width / 2, textY);
      textY += 45;
    }

    // 2. Draw Date Text
    if (state.showDate) {
      const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
      const dateString = new Date().toLocaleDateString('id-ID', options);
      
      ctx.font = '400 24px "Outfit"';
      ctx.fillStyle = isDarkFrame ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.fillText(dateString, width / 2, textY);
    }

    ctx.restore();
  }

  // Modal displays
  function showResultModal() {
    resultModal.classList.add('active');
  }

  function hideResultModal() {
    resultModal.classList.remove('active');
  }

  // --- INITIALIZE APPLICATION ---
  initCamera();
  updateViewportAspectRatio();
  applyFilterToFeed();
  updateLiveFramePreview();
  updateLiveFrameTexts();
  renderLiveLayoutSlots();
});
