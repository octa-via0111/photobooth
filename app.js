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
  const filterOverlay = document.getElementById('filter-overlay');
  const gridOverlay = document.getElementById('grid-overlay');
  const liveStickersContainer = document.getElementById('live-stickers-container');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');
  const flashOverlay = document.getElementById('flash-overlay');
  const captureProgressBar = document.getElementById('capture-progress-bar');
  
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
    });
  });

  // Filter selection
  const filterCards = document.querySelectorAll('.filter-selection .option-card');
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
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.frameColor = btn.getAttribute('data-color');
    });
  });

  // Frame Pattern selection
  const patternCards = document.querySelectorAll('.pattern-selection .option-card');
  patternCards.forEach(card => {
    card.addEventListener('click', () => {
      patternCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.framePattern = card.getAttribute('data-pattern');
    });
  });

  // Frame text input & date
  frameCustomText.addEventListener('input', (e) => {
    state.customText = e.target.value;
  });

  showDateCheckbox.addEventListener('change', (e) => {
    state.showDate = e.target.checked;
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
    videoViewport.insertBefore(mockCanvas, videoFeed);

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

  // Set view aspect ratio based on active layout
  function updateViewportAspectRatio() {
    videoViewport.style.transition = 'aspect-ratio 0.4s ease';
    
    if (state.layout === 'strip-4' || state.layout === 'strip-3') {
      // 4-Cut & 3-Cut Strip style is long vertical, but camera preview is standard 4:3.
      videoViewport.style.aspectRatio = '4 / 3';
    } else if (state.layout === 'grid-2x2') {
      videoViewport.style.aspectRatio = '4 / 3';
    } else if (state.layout === 'polaroid-single') {
      videoViewport.style.aspectRatio = '1 / 1';
    } else if (state.layout === 'landscape-single') {
      videoViewport.style.aspectRatio = '4 / 3';
    }
  }

  // Apply visual CSS filter to preview
  function applyFilterToFeed() {
    // Remove all previous filters
    filterOverlay.className = 'filter-overlay';
    
    if (state.filter !== 'normal') {
      filterOverlay.classList.add(`filter-${state.filter}-effect`);
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
    const totalPhotosNeeded = (state.layout === 'strip-4' || state.layout === 'grid-2x2') ? 4 : (state.layout === 'strip-3' ? 3 : 1);

    // Reset progress step classes
    const steps = captureProgressBar.querySelectorAll('.progress-step');
    steps.forEach(step => step.className = 'progress-step');
    
    if (totalPhotosNeeded > 1) {
      captureProgressBar.classList.add('active');
    }

    for (let i = 0; i < totalPhotosNeeded; i++) {
      // Focus current step progress bar
      if (totalPhotosNeeded > 1) {
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
      } else if (state.layout === 'grid-2x2') {
        canvasWidth = 2000;
        canvasHeight = 2200;
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

    // 5. Draw Stickers onto the Canvas relative to the photo containers
    drawStickersOnCanvas(ctx, photoBounds);
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
      case 'vintage-warm':
        return 'sepia(0.25) contrast(1.1) brightness(1.05) saturate(1.15)';
      case 'fresh-blush':
        return 'contrast(1.05) brightness(1.08) saturate(1.25) hue-rotate(-12deg)';
      case 'cyber-neon':
        return 'contrast(1.25) hue-rotate(130deg) saturate(1.4) brightness(0.95)';
      case 'mono-classic':
        return 'grayscale(1) contrast(1.3) brightness(0.95)';
      case 'dreamy-pastel':
        return 'brightness(1.12) contrast(0.9) saturate(0.85) sepia(0.05)';
      case 'tokyo-film':
        return 'contrast(1.08) brightness(1.02) saturate(0.9) sepia(0.12) hue-rotate(10deg)';
      case 'chroma-90s':
        return 'contrast(1.15) saturate(1.4) sepia(0.15) brightness(1.02)';
      case 'lomo-purple':
        return 'contrast(1.12) saturate(1.2) hue-rotate(-45deg) sepia(0.1)';
      case 'sunset-glow':
        return 'sepia(0.35) saturate(1.3) contrast(1.05) hue-rotate(-20deg) brightness(1.05)';
      case 'neo-noir':
        return 'grayscale(1) contrast(1.4) brightness(0.9)';
      case 'vibrant-peach':
        return 'contrast(1.05) saturate(1.3) brightness(1.08) sepia(0.12) hue-rotate(-15deg)';
      default:
        return 'none';
    }
  }

  // Translate stickers from live preview onto target canvas containers
  function drawStickersOnCanvas(ctx, photoBounds) {
    if (state.stickers.length === 0) return;

    const viewportRect = videoViewport.getBoundingClientRect();
    const vw = viewportRect.width;
    const vh = viewportRect.height;

    // For single photo modes (Polaroid & Landscape), place stickers on that photo box.
    // For 4-Cut, we can stamp the stickers on ALL photos, which makes the stickers look extremely cute and repeatable!
    photoBounds.forEach(bound => {
      state.stickers.forEach(sticker => {
        // Calculate relative coordinates in percentage of live video frame size
        const relX = sticker.x / vw;
        const relY = sticker.y / vh;
        
        // Map to HD canvas photo bounds coordinates
        const canvasStickerX = bound.x + (relX * bound.w);
        const canvasStickerY = bound.y + (relY * bound.h);
        
        // Scale sticker size relative to photo box size
        const sizeRatio = sticker.size / vw;
        const canvasStickerSize = Math.max(30, sizeRatio * bound.w * 1.5); // make it slightly bigger in HD

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
});
