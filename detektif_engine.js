/**
 * ============================================================================
 * DETEKTIF CERITA - CORE ENGINE & GAMEPLAY CONTROLLER
 * ============================================================================
 * Features:
 * 1. Name Input Validation & Gating (Must enter name before starting)
 * 2. Mission Progression & Gating without blocking valid completions
 * 3. Accurate Cumulative Timer synchronized with Construct 2 'waktu'
 * 4. Automatic Classification based on user rules:
 *    - < 10 MENIT: SANGAT CEPAT (SUPERIOR)
 *    - 10 – 15 MENIT: CEPAT (HEBAT)
 *    - 16 – 20 MENIT: CUKUP CEPAT (ANDAL)
 *    - > 20 MENIT: LAMBAT (PEMULA)
 * 5. Clean HUD: Corner Player Badge + Utility, NO redundant duplicate timers,
 *    NO obstruction of the central story text scroll.
 * 6. Prominent, Game-styled Cartoon Popup Alerts (bagus & kelihatan).
 * 7. Pixel-perfect 'Hasil Akhir' DOM overlay matching the game card & wooden buttons.
 * 8. Persistent History, Leaderboard, & Printable Detective Certificate.
 * ============================================================================
 */

(function () {
  'use strict';

  var DetectiveEngine = {
    // State
    playerName: '',
    startTime: null,
    endTime: null,
    elapsedSeconds: 0,
    timerInterval: null,
    currentLayoutName: '',
    isGameActive: false,
    history: [],
    currentResult: null,
    completedMissions: {},
    alertAutoTimer: null,

    // Audio elements
    sounds: {
      click: new Audio('media/click sound effect.ogg'),
      success: new Audio('media/success - sound effect.ogg'),
      warning: new Audio('media/wrong answer - sound effect hd.ogg')
    },

    // Mission targets configuration
    missionTargets: {
      'misi 1': { varName: 'JumlahTerisi', target: 9, title: 'Misi 1: Watak & Latar Cerita' },
      'misi 2': { varName: 'JumlahTerisi2', target: 9, title: 'Misi 2: Watak & Latar Cerita' },
      'misi 3': { varName: 'JumlahTerisi3', target: 9, title: 'Misi 3: Watak & Latar Cerita' },
      'misi 4': { varName: 'JumlahTerisi4', target: 6, title: 'Misi 4: Menentukan Unsur Intrinsik' },
      'misi 5': { varName: 'JumlahTerisi5', target: 6, title: 'Misi 5: Menentukan Unsur Intrinsik' },
      'misi 6': { varName: 'JumlahTerisi6', target: 6, title: 'Misi 6: Menentukan Unsur Intrinsik' },
      'misi 7': { varName: 'JumlahTerisi7', target: 3, title: 'Misi 7: Menyusun Urutan Alur' },
      'misi 8': { varName: 'JumlahTerisi8', target: 3, title: 'Misi 8: Menyusun Urutan Alur' },
      'misi 9': { varName: 'JumlahTerisi9', target: 3, title: 'Misi 9: Menyusun Urutan Alur' },
      'misi 10': { varName: 'JumlahTerisi10', target: 3, title: 'Misi 10: Menyusun Urutan Alur' }
    },

    // Initialization
    init: function () {
      this.loadHistory();
      this.injectHUD();
      this.injectGameAlertModal();
      this.injectModals();
      this.initAmbientParticles();
      this.setupC2Hook();
      this.setupCanvasInteractions();

      // Developer/QA URL parameters for instant testing
      if (window.location.search.indexOf('test=endscreen') !== -1) {
        var self = this;
        setTimeout(function () {
          self.testEndScreen('Lala', 515);
        }, 800);
      } else if (window.location.search.indexOf('test=alert') !== -1) {
        var self = this;
        setTimeout(function () {
          self.triggerMissionWarning('misi 3', 0, 9);
        }, 800);
      }

      console.log('🕵️ Detective Cerita Engine Initialized');
    },

    playSound: function (type) {
      try {
        var s = this.sounds[type];
        if (s) {
          s.currentTime = 0;
          s.play().catch(function () {});
        }
      } catch (e) {}
    },

    // LocalStorage management
    loadHistory: function () {
      try {
        var raw = localStorage.getItem('detektif_cerita_history');
        if (raw) {
          this.history = JSON.parse(raw);
        } else {
          this.history = [];
        }
        // Do NOT restore playerName into active session on startup:
        // A fresh session on Beranda has no active player yet until entered in 'identitas pengguna'.
        this.playerName = '';
      } catch (e) {
        this.history = [];
      }
    },

    saveHistoryRecord: function (record) {
      this.history.unshift(record);
      if (this.history.length > 50) this.history.pop();
      try {
        localStorage.setItem('detektif_cerita_history', JSON.stringify(this.history));
        localStorage.setItem('detektif_cerita_current', JSON.stringify(record));
        localStorage.setItem('NamaPemain', record.name);
        var currentBest = parseInt(localStorage.getItem('WaktuTerbaik') || '999999', 10);
        if (record.totalSeconds < currentBest) {
          localStorage.setItem('WaktuTerbaik', record.totalSeconds.toString());
        }
      } catch (e) {}
    },

    // Timer management
    startTimer: function () {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.startTime = Date.now();
      this.elapsedSeconds = 0;
      this.isGameActive = true;
      var self = this;
      this.timerInterval = setInterval(function () {
        if (self.isGameActive) {
          var c2waktu = self.getC2Var('waktu');
          if (c2waktu !== null && typeof c2waktu === 'number' && c2waktu > 0) {
            self.elapsedSeconds = c2waktu;
          } else {
            self.elapsedSeconds = Math.floor((Date.now() - self.startTime) / 1000);
          }
        }
      }, 500);
      console.log('⏱️ Game Timer Started');
    },

    stopTimer: function () {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.isGameActive = false;
      var c2waktu = this.getC2Var('waktu');
      if (c2waktu !== null && typeof c2waktu === 'number' && c2waktu > 0) {
        this.elapsedSeconds = c2waktu;
      } else if (this.startTime) {
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      }
      console.log('⏱️ Game Timer Stopped at', this.elapsedSeconds, 'seconds');
    },

    formatTime: function (secs) {
      var m = Math.floor(secs / 60);
      var s = secs % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    },

    formatTimeIndo: function (secs) {
      var m = Math.floor(secs / 60);
      var s = secs % 60;
      if (m > 0 && s > 0) return m + ' Menit ' + s + ' Detik';
      if (m > 0) return m + ' Menit';
      return s + ' Detik';
    },

    // =========================================================================
    // PERFORMANCE CLASSIFICATION (RULES REQUESTED BY USER)
    // SANGAT CEPAT = < 10 MENIT (SUPERIOR)
    // CEPAT        = 10 – 15 MENIT (HEBAT)
    // CUKUP CEPAT  = 16 – 20 MENIT (ANDAL)
    // LAMBAT       = > 20 MENIT (PEMULA)
    // =========================================================================
    evaluatePerformance: function (totalSecs) {
      var minutes = totalSecs / 60;
      var category = '';
      var predicate = '';
      var predTitle = '';
      var stars = 4;
      var catKey = 'cukup-cepat';
      var predKey = 'andal';

      if (minutes < 10) { // < 10 Menit (< 600 detik)
        category = 'Sangat Cepat';
        predicate = 'Superior';
        predTitle = 'Detektif Superior';
        stars = 5;
        catKey = 'sangat-cepat';
        predKey = 'superior';
      } else if (minutes <= 15) { // 10 - 15 Menit (600 - 900 detik)
        category = 'Cepat';
        predicate = 'Hebat';
        predTitle = 'Detektif Hebat';
        stars = 4;
        catKey = 'cepat';
        predKey = 'hebat';
      } else if (minutes <= 20) { // 16 - 20 Menit (901 - 1200 detik)
        category = 'Cukup Cepat';
        predicate = 'Andal';
        predTitle = 'Detektif Andal';
        stars = 3;
        catKey = 'cukup-cepat';
        predKey = 'andal';
      } else { // > 20 Menit (> 1200 detik)
        category = 'Lambat';
        predicate = 'Pemula';
        predTitle = 'Detektif Pemula';
        stars = 2;
        catKey = 'lambat';
        predKey = 'pemula';
      }

      return {
        category: category,
        predicate: predicate,
        predTitle: predTitle,
        stars: stars,
        catKey: catKey,
        predKey: predKey
      };
    },

    // Construct 2 Variable Helpers
    getC2Var: function (name) {
      var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
      if (!rt) return null;

      // 1. Search in all_global_vars
      if (rt.all_global_vars) {
        for (var i = 0; i < rt.all_global_vars.length; i++) {
          if (rt.all_global_vars[i].name && rt.all_global_vars[i].name.toLowerCase() === name.toLowerCase()) {
            return rt.all_global_vars[i].data;
          }
        }
      }

      // 2. Search in eventsheets
      if (rt.eventsheets_by_index) {
        for (var s = 0; s < rt.eventsheets_by_index.length; s++) {
          var sheet = rt.eventsheets_by_index[s];
          if (sheet && sheet.events) {
            for (var e = 0; e < sheet.events.length; e++) {
              var ev = sheet.events[e];
              if (ev && ev.name && ev.name.toLowerCase() === name.toLowerCase()) {
                return ev.data;
              }
            }
          }
        }
      }

      return null;
    },

    setC2Var: function (name, val) {
      var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
      if (!rt) return;

      if (rt.all_global_vars) {
        for (var i = 0; i < rt.all_global_vars.length; i++) {
          if (rt.all_global_vars[i].name && rt.all_global_vars[i].name.toLowerCase() === name.toLowerCase()) {
            rt.all_global_vars[i].setValue(val);
            return;
          }
        }
      }

      if (rt.eventsheets_by_index) {
        for (var s = 0; s < rt.eventsheets_by_index.length; s++) {
          var sheet = rt.eventsheets_by_index[s];
          if (sheet && sheet.events) {
            for (var e = 0; e < sheet.events.length; e++) {
              var ev = sheet.events[e];
              if (ev && ev.name && ev.name.toLowerCase() === name.toLowerCase() && ev.setValue) {
                ev.setValue(val);
                return;
              }
            }
          }
        }
      }
    },

    // Hook into Construct 2
    setupC2Hook: function () {
      var self = this;
      var checkC2 = setInterval(function () {
        var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
        if (rt && rt.doChangeLayout) {
          clearInterval(checkC2);
          self.attachRuntimeHooks(rt);
        }
      }, 50);
    },

    attachRuntimeHooks: function (rt) {
      var self = this;
      var proto = Object.getPrototypeOf(rt);
      if (proto._detektifHooked) return;
      proto._detektifHooked = true;
      var origDoChangeLayout = proto.doChangeLayout;

      proto.doChangeLayout = function (changeToLayout) {
        var fromLayout = this.running_layout ? this.running_layout.name : '';
        var toLayout = changeToLayout ? changeToLayout.name : '';

        // 1. GATING: VALIDASI NAMA PADA 'identitas pengguna'
        if (fromLayout === 'identitas pengguna' && toLayout === 'misi 1') {
          var inputEl = document.querySelector('#c2canvasdiv input, input[type="text"], input');
          var nameVal = (inputEl ? inputEl.value : '').trim();

          if (!nameVal || nameVal.length < 2) {
            // BATALKAN TRANSISI KE MISI 1!
            this.changelayout = null;
            if (this.system && this.system.waits) {
              cr.clearArray(this.system.waits);
            }
            self.triggerNameWarning(inputEl);
            return;
          }

          // Nama valid: simpan nama dan mulai waktu
          self.playerName = nameVal;
          self.setC2Var('namapemain', nameVal);
          try {
            localStorage.setItem('NamaPemain', nameVal);
          } catch (e) {}
          self.startTimer();
          self.updateHUDPlayer();
        }

        // 2. Track mission completion when reaching feedback benar
        if (fromLayout.indexOf('misi ') === 0 && toLayout.indexOf('feedback benar') === 0) {
          self.completedMissions[fromLayout] = true;
          // IMPORTANT: Never block transition to feedback benar!
          // Construct 2 only triggers feedback benar when its own puzzle rules are met.
        }

        // Jalankan layout transition asli C2
        origDoChangeLayout.call(this, changeToLayout);

        // Callback setelah layout berubah
        setTimeout(function () {
          self.onLayoutChanged(toLayout);
        }, 50);
      };

      // Hook C2 Text plugin to NEVER draw native Text instances on 'hasil akhir' layout
      try {
        if (window.cr && window.cr.plugins_ && window.cr.plugins_.Text) {
          var textProto = window.cr.plugins_.Text.prototype.Instance.prototype;
          if (!textProto._detektifTextHooked) {
            textProto._detektifTextHooked = true;
            var origDraw = textProto.draw;
            var origDrawGL = textProto.drawGL;
            textProto.draw = function (ctx) {
              if (this.layer && this.layer.layout && this.layer.layout.name === 'hasil akhir') {
                return;
              }
              if (origDraw) return origDraw.apply(this, arguments);
            };
            textProto.drawGL = function (glw) {
              if (this.layer && this.layer.layout && this.layer.layout.name === 'hasil akhir') {
                return;
              }
              if (origDrawGL) return origDrawGL.apply(this, arguments);
            };
          }
        }
      } catch (e) {}

      console.log('🔒 Construct 2 Lifecycle & Layout Guards Active');
    },

    // Clear and hide native Construct 2 Text instances on 'hasil akhir'
    clearHasilAkhirC2Texts: function () {
      try {
        var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
        if (rt && rt.types_by_index) {
          for (var t = 0; t < rt.types_by_index.length; t++) {
            var typeObj = rt.types_by_index[t];
            if (typeObj && typeObj.instances) {
              for (var k = 0; k < typeObj.instances.length; k++) {
                var inst = typeObj.instances[k];
                if (inst && inst.layer && inst.layer.layout && inst.layer.layout.name === 'hasil akhir') {
                  if (inst.text !== undefined) {
                    inst.text = '';
                    inst.visible = false;
                    inst.opacity = 0;
                    inst.x = -9999;
                    inst.y = -9999;
                  }
                }
              }
            }
          }
        }
      } catch (e) {}
    },

    // Screen change handling
    onLayoutChanged: function (layoutName) {
      this.currentLayoutName = layoutName;
      this.removeHasilAkhirOverlay();

      var playerHud = document.getElementById('game-hud-player');
      var actionsHud = document.getElementById('game-hud-actions');

      if (!playerHud || !actionsHud) {
        this.injectHUD();
        playerHud = document.getElementById('game-hud-player');
        actionsHud = document.getElementById('game-hud-actions');
      }

      var isGameplay = (layoutName.indexOf('misi') === 0 || 
                        layoutName.indexOf('jawaban pg') === 0 || 
                        layoutName.indexOf('pilihan ganda') === 0 ||
                        layoutName.indexOf('petunjuk') === 0);
      var isMainMenu = (layoutName === 'main menu' || layoutName === 'main menu 2');
      var isResults = (layoutName === 'hasil akhir');
      var isHiddenScreen = (layoutName === 'loading' || 
                            layoutName === 'loading+judul' || 
                            layoutName === 'identitas pengguna' || 
                            layoutName.indexOf('video') === 0);

      if (isResults || isHiddenScreen) {
        if (playerHud) playerHud.style.display = 'none';
        if (actionsHud) actionsHud.style.display = 'none';
        if (isResults) {
          this.clearHasilAkhirC2Texts();
          var self = this;
          setTimeout(function () { self.clearHasilAkhirC2Texts(); }, 120);
          setTimeout(function () { self.clearHasilAkhirC2Texts(); }, 350);
          this.finishGame();
        }
      } else if (isGameplay) {
        // Gameplay (Misi 1 - 10, dsb): Papan Skor & Fullscreen di pojok kanan bawah
        if (actionsHud) actionsHud.style.display = 'flex';
        // Nama Pemain di pojok kiri bawah: Tampilkan badge detektif saat misi berlangsung
        if (playerHud) {
          var activeName = this.playerName || this.getC2Var('namapemain') || localStorage.getItem('NamaPemain') || 'Detektif';
          if (activeName && activeName.trim().length > 0) {
            this.playerName = activeName.trim();
          }
          playerHud.style.display = 'flex';
          this.updateHUDPlayer();
        }
      } else if (isMainMenu) {
        // Beranda: Papan Skor & Fullscreen di pojok kanan bawah
        if (actionsHud) actionsHud.style.display = 'flex';
        // Di Beranda: Sembunyikan badge nama karena pemain belum mengisi identitas
        if (playerHud) {
          playerHud.style.display = 'none';
        }
      } else {
        // Menu pendukung lainnya (materi, tujuan, informasi, profil)
        if (actionsHud) actionsHud.style.display = 'flex';
        // Sembunyikan badge nama di menu pendukung agar tampilan bersih
        if (playerHud) {
          playerHud.style.display = 'none';
        }
      }

      // If on 'identitas pengguna', enhance input element and reset name
      if (layoutName === 'identitas pengguna') {
        this.playerName = '';
        this.updateHUDPlayer();
        this.enhanceNameInput();
      }

      // If returning to main menu, stop timer and reset session if not finished
      if (layoutName === 'main menu' || layoutName === 'main menu 2') {
        if (!this.isGameActive) {
          this.elapsedSeconds = 0;
        }
      }
    },

    // Name Input Enhancement
    enhanceNameInput: function () {
      var self = this;
      setTimeout(function () {
        var input = document.querySelector('#c2canvasdiv input, input[type="text"], input');
        if (input) {
          input.value = '';
          input.setAttribute('placeholder', 'Ketik nama detektif...');
          input.setAttribute('maxlength', '20');
          input.setAttribute('autocomplete', 'off');
          input.setAttribute('spellcheck', 'false');
          input.focus();

          input.oninput = function () {
            self.playerName = this.value.trim();
            self.updateHUDPlayer();
          };

          input.onkeydown = function (e) {
            if (e.key === 'Enter') {
              var canvas = document.getElementById('c2canvas');
              if (canvas) {
                var rect = canvas.getBoundingClientRect();
                var clickX = rect.left + rect.width * 0.5;
                var clickY = rect.top + rect.height * 0.76;
                var evt = new MouseEvent('click', {
                  clientX: clickX,
                  clientY: clickY,
                  bubbles: true
                });
                canvas.dispatchEvent(evt);
              }
            }
          };
        }
      }, 100);
    },

    // Canvas click interception for guidance on 'Next' button
    setupCanvasInteractions: function () {
      var self = this;
      var canvas = document.getElementById('c2canvas');
      if (!canvas) return;

      canvas.addEventListener('click', function (e) {
        if (!self.currentLayoutName) return;

        // Check if on a puzzle mission layout (misi 1 - 6)
        if (self.currentLayoutName.indexOf('misi ') === 0) {
          var config = self.missionTargets[self.currentLayoutName];
          if (!config) return;

          // If this mission was already completed, don't interfere
          if (self.completedMissions[self.currentLayoutName]) return;

          var rect = canvas.getBoundingClientRect();
          var scaleX = canvas.width / rect.width;
          var scaleY = canvas.height / rect.height;
          var canvasX = (e.clientX - rect.left) * scaleX;
          var canvasY = (e.clientY - rect.top) * scaleY;

          // In missions 1-6, 'button_next' is located around (1622, 67), width: 205, height: 117
          if (canvasX >= 1500 && canvasX <= 1720 && canvasY >= 0 && canvasY <= 140) {
            var currentVal = self.getC2Var(config.varName) || 0;
            if (currentVal < config.target) {
              self.triggerMissionWarning(self.currentLayoutName, currentVal, config.target);
            }
          }
        }
      }, true);
    },

    // Prominent Game Modal Alert System (bagus & kelihatan)
    injectGameAlertModal: function () {
      if (document.getElementById('game-alert-modal')) return;

      var modal = document.createElement('div');
      modal.id = 'game-alert-modal';
      modal.className = 'game-alert-modal-backdrop';
      modal.innerHTML =
        '<div class="game-alert-modal-card" id="game-alert-card">' +
          '<button class="alert-modal-close" id="btn-close-alert" title="Tutup">✕</button>' +
          '<div class="alert-modal-badge-wrapper">' +
            '<div class="alert-modal-badge" id="alert-modal-icon">🦊🔎</div>' +
          '</div>' +
          '<h3 class="alert-modal-title" id="alert-modal-title">Perhatian Detektif!</h3>' +
          '<div class="alert-modal-divider"></div>' +
          '<div class="alert-modal-content" id="alert-modal-content"></div>' +
          '<div class="alert-modal-footer">' +
            '<button class="wood-action-btn alert-modal-btn" id="btn-ok-alert">' +
              '<span class="wood-icon-bubble">👍</span>' +
              '<span class="wood-text" id="alert-modal-btn-text">Siap, Lanjutkan!</span>' +
            '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(modal);

      var self = this;
      var closeFunc = function () {
        self.playSound('click');
        self.closeGameAlert();
      };
      document.getElementById('btn-close-alert').onclick = closeFunc;
      document.getElementById('btn-ok-alert').onclick = closeFunc;
      modal.onclick = function (e) {
        if (e.target === modal) closeFunc();
      };

      document.addEventListener('keydown', function (e) {
        if (modal.classList.contains('active')) {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            closeFunc();
          }
        }
      });
    },

    showGameAlert: function (opts) {
      this.injectGameAlertModal();
      var modal = document.getElementById('game-alert-modal');
      if (!modal) return;

      document.getElementById('alert-modal-icon').innerHTML = opts.icon || '🦊🔎';
      document.getElementById('alert-modal-title').textContent = opts.title || 'Perhatian Detektif!';
      document.getElementById('alert-modal-content').innerHTML = opts.body || '';
      document.getElementById('alert-modal-btn-text').textContent = opts.btnText || 'Siap, Lanjutkan!';

      modal.classList.add('active');
      this.playSound(opts.sound || 'warning');

      if (this.alertAutoTimer) clearTimeout(this.alertAutoTimer);
      var self = this;
      this.alertAutoTimer = setTimeout(function () {
        self.closeGameAlert();
      }, opts.duration || 6500);
    },

    closeGameAlert: function () {
      if (this.alertAutoTimer) clearTimeout(this.alertAutoTimer);
      var modal = document.getElementById('game-alert-modal');
      if (modal) modal.classList.remove('active');
    },

    triggerMissionWarning: function (missionName, current, target) {
      var sisa = Math.max(1, target - (current || 0));
      this.showGameAlert({
        icon: '🧩🔍',
        title: 'Teka-teki Belum Selesai!',
        body: '<div class="alert-highlight">Masih tersisa <strong>' + sisa + ' potongan lagi</strong> yang harus diletakkan!</div>' +
              '<div class="alert-hint">Periksa kembali teks cerita, lalu pasangkan seluruh potongan watak, latar, atau amanat pada tempat yang tepat sebelum melanjutkan penyelidikan.</div>',
        btnText: 'Siap, Cari Lagi! 🔎',
        sound: 'warning',
        duration: 7000
      });
    },

    triggerNameWarning: function (inputEl) {
      this.showGameAlert({
        icon: '✍️🕵️',
        title: 'Nama Belum Diisi!',
        body: '<div class="alert-highlight">Masukkan nama detektif kamu terlebih dahulu (minimal 2 karakter)!</div>' +
              '<div class="alert-hint">Nama detektif akan dicatatkan pada Buku Rekor dan Piagam Detektif resmi.</div>',
        btnText: 'Ketik Nama ✏️',
        sound: 'warning',
        duration: 5000
      });

      if (inputEl) {
        inputEl.classList.remove('input-invalid-shake');
        void inputEl.offsetWidth;
        inputEl.classList.add('input-invalid-shake');
        inputEl.focus();
        setTimeout(function () {
          inputEl.classList.remove('input-invalid-shake');
        }, 700);
      }
    },

    // =========================================================================
    // GAME FINISH & RESULTS DISPLAY ('hasil akhir')
    // Matches Screenshot 2 perfectly:
    // Top box: Nama Pemain
    // Box 1: Total Waktu (08:35, menit:detik)
    // Box 2: Kategori Waktu (Sangat Cepat / Cepat / Cukup Cepat / Lambat)
    // Box 3: Predikat (Superior / Hebat / Andal / Pemula)
    // Bottom: [Mulai Ulang] & [Kembali ke Beranda] (wooden pill buttons)
    // =========================================================================
    finishGame: function () {
      this.stopTimer();

      // Read time directly from Construct 2 'waktu' variable or fallback to elapsedSeconds
      var c2waktu = this.getC2Var('waktu');
      var finalSeconds = Math.max(1, (c2waktu !== null && typeof c2waktu === 'number' && c2waktu > 0) ? c2waktu : this.elapsedSeconds);
      var perf = this.evaluatePerformance(finalSeconds);
      var formatted = this.formatTime(finalSeconds);

      var record = {
        id: Date.now(),
        name: this.playerName || localStorage.getItem('NamaPemain') || 'Detektif Cilik',
        totalSeconds: finalSeconds,
        timeFormatted: formatted,
        timeText: this.formatTimeIndo(finalSeconds),
        category: perf.category,
        predicate: perf.predicate,
        predTitle: perf.predTitle,
        stars: perf.stars,
        catKey: perf.catKey,
        predKey: perf.predKey,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      this.currentResult = record;
      this.saveHistoryRecord(record);
      this.playSound('success');

      // Hide or clear C2 default text 207 to prevent font doubling on canvas
      try {
        var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
        if (rt && rt.types_by_index) {
          for (var t = 0; t < rt.types_by_index.length; t++) {
            var typeObj = rt.types_by_index[t];
            if (typeObj && typeObj.instances) {
              for (var k = 0; k < typeObj.instances.length; k++) {
                var inst = typeObj.instances[k];
                if (inst && inst.text !== undefined && inst.layer && inst.layer.layout && inst.layer.layout.name === 'hasil akhir') {
                  inst.text = '';
                  inst.visible = false;
                }
              }
            }
          }
        }
      } catch (e) {}

      // Celebration Confetti!
      this.launchConfetti();

      // Render DOM overlay matching Screenshot 2
      this.renderHasilAkhirOverlay(record);
    },

    renderHasilAkhirOverlay: function (record) {
      this.removeHasilAkhirOverlay();

      var container = document.getElementById('c2canvasdiv');
      if (!container) return;

      var overlay = document.createElement('div');
      overlay.id = 'hasil-akhir-overlay';
      overlay.className = 'hasil-akhir-overlay';

      overlay.innerHTML =
        // 1. Top Scalloped Box: Player Name (Large, Bold, Cartoon Font)
        '<div class="result-slot-name">' +
          '<div class="result-player-title">' +
            '<span class="title-prefix">DETEKTIF :</span>' +
            '<span class="title-name">' + this.escapeHtml(record.name) + '</span>' +
          '</div>' +
        '</div>' +

        // 2. Alarm Clock slot: Total Time
        '<div class="result-card result-card-clock">' +
          '<div class="result-card-label">Total Waktu</div>' +
          '<div class="result-card-box result-clock-box">' +
            '<div class="result-time-num">' + record.timeFormatted + '</div>' +
            '<div class="result-time-unit">menit : detik</div>' +
          '</div>' +
        '</div>' +

        // 3. Speedometer slot: Time Category (Directly centered in yellow box)
        '<div class="result-card result-card-speedo">' +
          '<div class="result-card-label">Kategori Waktu</div>' +
          '<div class="result-card-box result-category-text">' +
            record.category +
          '</div>' +
        '</div>' +

        // 4. Medal slot: Predicate (Directly centered in teal box)
        '<div class="result-card result-card-medal">' +
          '<div class="result-card-label">Predikat</div>' +
          '<div class="result-card-box result-predicate-text">' +
            record.predTitle +
          '</div>' +
        '</div>' +

        // 5. Wooden Action Buttons at Bottom (4 Full-Sized Thematic Wooden Buttons)
        '<div class="result-wood-actions">' +
          '<button class="wood-action-btn wood-btn-restart" id="btn-restart-game">' +
            '<span class="wood-icon-bubble">↻</span>' +
            '<span class="wood-text">Mulai Ulang</span>' +
          '</button>' +
          '<button class="wood-action-btn wood-btn-home" id="btn-main-menu">' +
            '<span class="wood-icon-bubble">🏠</span>' +
            '<span class="wood-text">Beranda</span>' +
          '</button>' +
          '<button class="wood-action-btn wood-btn-leaderboard" id="btn-show-leaderboard">' +
            '<span class="wood-icon-bubble">🏆</span>' +
            '<span class="wood-text">Papan Skor</span>' +
          '</button>' +
          '<button class="wood-action-btn wood-btn-cert" id="btn-show-certificate">' +
            '<span class="wood-icon-bubble">📜</span>' +
            '<span class="wood-text">Piagam</span>' +
          '</button>' +
        '</div>';

      container.appendChild(overlay);

      // Bind button events
      var self = this;
      document.getElementById('btn-show-leaderboard').onclick = function () {
        self.playSound('click');
        self.openModal('leaderboard-modal');
      };
      document.getElementById('btn-show-certificate').onclick = function () {
        self.playSound('click');
        self.openModal('certificate-modal');
      };
      document.getElementById('btn-restart-game').onclick = function () {
        self.playSound('click');
        self.restartGame();
      };
      document.getElementById('btn-main-menu').onclick = function () {
        self.playSound('click');
        self.stopTimer();
        self.setC2Var('waktu', 0);
        self.goToLayout('main menu');
      };
    },

    removeHasilAkhirOverlay: function () {
      var old = document.getElementById('hasil-akhir-overlay');
      if (old && old.parentNode) {
        old.parentNode.removeChild(old);
      }
    },

    goToLayout: function (layoutName) {
      var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
      if (rt && rt.layouts && rt.layouts[layoutName]) {
        rt.changelayout = null;
        if (rt.doChangeLayout) {
          rt.doChangeLayout(rt.layouts[layoutName]);
        } else {
          rt.changelayout = rt.layouts[layoutName];
        }
      }
    },

    restartGame: function () {
      this.stopTimer();
      this.setC2Var('waktu', 0);
      this.elapsedSeconds = 0;
      this.completedMissions = {};
      this.startTimer();
      this.goToLayout('misi 1');
    },

    // =========================================================================
    // THEMATIC WOODEN HUD (MATCHES GAME MENU & BUTTON ART STYLE)
    // =========================================================================
    injectHUD: function () {
      if (document.getElementById('game-hud-player')) return;

      var container = document.getElementById('c2canvasdiv') || document.body;

      // 1. Left Badge: Detective Player Name
      var playerHud = document.createElement('div');
      playerHud.id = 'game-hud-player';
      playerHud.className = 'game-hud-player';
      playerHud.style.display = 'none';
      playerHud.innerHTML =
        '<div class="hud-wood-badge hud-player-pill" id="hud-player-pill">' +
          '<div class="hud-badge-avatar">🦊</div>' +
          '<div class="hud-badge-info">' +
            '<span class="hud-badge-label">DETEKTIF</span>' +
            '<span class="hud-badge-name" id="hud-player-name">PEMAIN</span>' +
          '</div>' +
        '</div>';
      container.appendChild(playerHud);

      // 2. Right Action Buttons: Papan Skor & Fullscreen
      var actionsHud = document.createElement('div');
      actionsHud.id = 'game-hud-actions';
      actionsHud.className = 'game-hud-actions';
      actionsHud.style.display = 'none';
      actionsHud.innerHTML =
        '<button class="hud-wood-btn hud-btn-rekor" id="hud-btn-lb" title="Papan Skor & Rekor Permainan">' +
          '<span class="hud-icon-bubble">🏆</span>' +
          '<span class="hud-btn-text">Papan Skor</span>' +
        '</button>' +
        '<button class="hud-wood-btn hud-btn-fs" id="hud-btn-fs" title="Layar Penuh">' +
          '<span class="hud-fs-icon">⛶</span>' +
        '</button>';
      container.appendChild(actionsHud);

      var self = this;
      document.getElementById('hud-btn-lb').onclick = function () {
        self.playSound('click');
        self.openModal('leaderboard-modal');
      };
      document.getElementById('hud-btn-fs').onclick = function () {
        self.toggleFullscreen();
      };

      this.updateHUDPlayer();
    },

    updateHUDPlayer: function () {
      var el = document.getElementById('hud-player-name');
      if (el) {
        var name = (this.playerName || 'Detektif').toUpperCase();
        el.textContent = name;
      }
    },

    toggleFullscreen: function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function () {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    },

    // =========================================================================
    // MODAL WINDOWS: LEADERBOARD & CERTIFICATE
    // =========================================================================
    injectModals: function () {
      if (document.getElementById('leaderboard-modal')) return;

      // 1. Leaderboard Modal
      var lbModal = document.createElement('div');
      lbModal.id = 'leaderboard-modal';
      lbModal.className = 'detective-modal-backdrop';
      lbModal.innerHTML =
        '<div class="detective-modal-card">' +
          '<div class="modal-header">' +
            '<h2 class="modal-title">🏆 Papan Skor & Riwayat Detektif</h2>' +
            '<button class="modal-close-btn" data-close="leaderboard-modal">✕</button>' +
          '</div>' +
          '<div class="modal-body" id="leaderboard-body"></div>' +
        '</div>';
      document.body.appendChild(lbModal);

      // 2. Certificate Modal
      var certModal = document.createElement('div');
      certModal.id = 'certificate-modal';
      certModal.className = 'detective-modal-backdrop';
      certModal.innerHTML =
        '<div class="detective-modal-card">' +
          '<div class="modal-header">' +
            '<h2 class="modal-title">📜 Piagam Lencana Detektif</h2>' +
            '<div style="display:flex;gap:8px;">' +
              '<button class="corner-btn" id="btn-print-cert" title="Cetak Piagam" style="width:auto;border-radius:999px;padding:0 14px;font-size:13px;font-weight:700;">🖨️ Cetak</button>' +
              '<button class="modal-close-btn" data-close="certificate-modal">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="modal-body" id="certificate-body"></div>' +
        '</div>';
      document.body.appendChild(certModal);

      var self = this;
      document.querySelectorAll('[data-close]').forEach(function (btn) {
        btn.onclick = function () {
          var modalId = this.getAttribute('data-close');
          self.closeModal(modalId);
        };
      });

      [lbModal, certModal].forEach(function (modal) {
        modal.onclick = function (e) {
          if (e.target === modal) {
            self.closeModal(modal.id);
          }
        };
      });

      document.getElementById('btn-print-cert').onclick = function () {
        window.print();
      };
    },

    openModal: function (id) {
      if (id === 'leaderboard-modal') {
        this.renderLeaderboard();
      } else if (id === 'certificate-modal') {
        this.renderCertificate();
      }
      var el = document.getElementById(id);
      if (el) el.classList.add('active');
    },

    closeModal: function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('active');
    },

    renderLeaderboard: function () {
      var body = document.getElementById('leaderboard-body');
      if (!body) return;

      if (!this.history || this.history.length === 0) {
        body.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-icon">🔍</div>' +
            '<div style="font-size:18px;font-weight:700;color:#f8fafc;margin-bottom:6px;">Belum Ada Riwayat Detektif</div>' +
            '<div>Selesaikan seluruh 10 misi untuk mencatatkan rekor pertamamu!</div>' +
          '</div>';
        return;
      }

      var sorted = this.history.slice().sort(function (a, b) {
        return a.totalSeconds - b.totalSeconds;
      });

      var html = '<div class="leaderboard-list">';
      sorted.forEach(function (item, index) {
        var rank = index + 1;
        var rankClass = '';
        var medal = rank.toString();
        if (rank === 1) { rankClass = 'rank-1'; medal = '🥇'; }
        else if (rank === 2) { rankClass = 'rank-2'; medal = '🥈'; }
        else if (rank === 3) { rankClass = 'rank-3'; medal = '🥉'; }

        html +=
          '<div class="leaderboard-item ' + rankClass + '">' +
            '<div class="lb-left">' +
              '<div class="lb-rank">' + medal + '</div>' +
              '<div>' +
                '<div class="lb-name">' + DetectiveEngine.escapeHtml(item.name) + '</div>' +
                '<div class="lb-meta">' + item.dateStr + ' • ' + (item.predTitle || item.predicate) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="lb-right">' +
              '<div class="lb-time">' + item.timeFormatted + '</div>' +
              '<div class="lb-badge">' + item.category + '</div>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';

      html +=
        '<div style="margin-top:20px;text-align:center;">' +
          '<button id="btn-clear-lb" style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;text-decoration:underline;">' +
            'Hapus Riwayat' +
          '</button>' +
        '</div>';

      body.innerHTML = html;

      var self = this;
      var clearBtn = document.getElementById('btn-clear-lb');
      if (clearBtn) {
        clearBtn.onclick = function () {
          if (confirm('Yakin ingin mereset seluruh riwayat permainan?')) {
            self.history = [];
            localStorage.removeItem('detektif_cerita_history');
            self.renderLeaderboard();
          }
        };
      }
    },

    renderCertificate: function () {
      var body = document.getElementById('certificate-body');
      if (!body) return;

      var res = this.currentResult || (this.history[0] || {
        name: this.playerName || 'Detektif Cilik',
        totalSeconds: this.elapsedSeconds || 515,
        timeFormatted: this.formatTime(this.elapsedSeconds || 515),
        timeText: this.formatTimeIndo(this.elapsedSeconds || 515),
        category: 'Sangat Cepat',
        predicate: 'Superior',
        predTitle: 'Detektif Superior',
        stars: 5,
        dateStr: new Date().toLocaleDateString('id-ID')
      });

      var starsStr = '';
      for (var i = 0; i < (res.stars || 4); i++) {
        starsStr += '★ ';
      }

      body.innerHTML =
        '<div class="cert-card">' +
          '<div class="cert-title">Piagam Lencana Detektif</div>' +
          '<div class="cert-sub">Media Pembelajaran Interaktif Unsur Intrinsik Cerita</div>' +
          '<div style="font-size:14px;color:#78350f;">Diberikan secara resmi kepada:</div>' +
          '<div class="cert-name">' + this.escapeHtml(res.name) + '</div>' +
          '<div style="font-size:14px;color:#4a2818;max-width:440px;margin:0 auto;">' +
            'Telah berhasil menuntaskan seluruh 10 Misi Kasus Detektif Cerita dengan analisa tajam, ketelitian, dan pemahaman sastra yang unggul.' +
          '</div>' +

          '<div class="cert-stats-grid">' +
            '<div class="cert-stat-box">' +
              '<div class="cert-stat-lbl">Waktu Total</div>' +
              '<div class="cert-stat-val">' + res.timeFormatted + '</div>' +
            '</div>' +
            '<div class="cert-stat-box">' +
              '<div class="cert-stat-lbl">Kategori Waktu</div>' +
              '<div class="cert-stat-val">' + res.category + '</div>' +
            '</div>' +
            '<div class="cert-stat-box">' +
              '<div class="cert-stat-lbl">Predikat Kelulusan</div>' +
              '<div class="cert-stat-val">' + (res.predTitle || res.predicate) + '</div>' +
            '</div>' +
          '</div>' +

          '<div style="color:#d97706;font-size:20px;letter-spacing:2px;margin:10px 0;">' + starsStr + '</div>' +

          '<div class="cert-footer">' +
            '<div style="text-align:left;">' +
              '<div>Tanggal: ' + res.dateStr + '</div>' +
              '<div style="font-size:11px;color:#a16207;">BBGTK Jawa Tengah & Kemendikdasmen</div>' +
            '</div>' +
            '<div class="cert-seal">🎖️</div>' +
            '<div style="text-align:right;">' +
              '<div style="font-weight:700;">Status: TERVERIFIKASI</div>' +
              '<div style="font-size:11px;color:#a16207;">KODE: DETEKTIF-SUPERIOR</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    // =========================================================================
    // AMBIENT PARTICLES & CELEBRATION CONFETTI
    // =========================================================================
    initAmbientParticles: function () {
      if (document.getElementById('ambient-particles-canvas')) return;

      var canvas = document.createElement('canvas');
      canvas.id = 'ambient-particles-canvas';
      document.body.prepend(canvas);

      var ctx = canvas.getContext('2d');
      var width = (canvas.width = window.innerWidth);
      var height = (canvas.height = window.innerHeight);

      window.addEventListener('resize', function () {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      });

      var particles = [];
      var count = 35;
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 2 + 0.6,
          speedY: Math.random() * 0.4 + 0.1,
          speedX: (Math.random() - 0.5) * 0.25,
          opacity: Math.random() * 0.5 + 0.2,
          pulse: Math.random() * 0.02 + 0.01
        });
      }

      function render() {
        ctx.clearRect(0, 0, width, height);
        for (var j = 0; j < particles.length; j++) {
          var p = particles[j];
          p.y -= p.speedY;
          p.x += p.speedX;
          p.opacity += Math.sin(Date.now() * p.pulse * 0.1) * 0.005;

          if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(245, 176, 65, ' + Math.max(0.1, Math.min(0.7, p.opacity)) + ')';
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(243, 156, 18, 0.6)';
          ctx.fill();
        }
        requestAnimationFrame(render);
      }
      render();
    },

    launchConfetti: function () {
      var confettiCanvas = document.createElement('canvas');
      confettiCanvas.style.position = 'fixed';
      confettiCanvas.style.inset = '0';
      confettiCanvas.style.width = '100vw';
      confettiCanvas.style.height = '100vh';
      confettiCanvas.style.pointerEvents = 'none';
      confettiCanvas.style.zIndex = '80';
      document.body.appendChild(confettiCanvas);

      var ctx = confettiCanvas.getContext('2d');
      var w = (confettiCanvas.width = window.innerWidth);
      var h = (confettiCanvas.height = window.innerHeight);

      var pieces = [];
      var colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#fde047'];

      for (var i = 0; i < 130; i++) {
        pieces.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.35),
          w: Math.random() * 11 + 5,
          h: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 6,
          vy: Math.random() * 4 + 3,
          rot: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 10,
          opacity: 1
        });
      }

      var start = Date.now();
      function drawConfetti() {
        ctx.clearRect(0, 0, w, h);
        var elapsed = Date.now() - start;

        for (var j = 0; j < pieces.length; j++) {
          var p = pieces[j];
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.rotSpeed;
          if (elapsed > 2500) {
            p.opacity -= 0.02;
          }

          if (p.opacity > 0) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot * Math.PI) / 180);
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
          }
        }

        if (elapsed < 4200) {
          requestAnimationFrame(drawConfetti);
        } else {
          if (confettiCanvas.parentNode) {
            confettiCanvas.parentNode.removeChild(confettiCanvas);
          }
        }
      }
      drawConfetti();
    },

    escapeHtml: function (str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // Testing helper to easily preview end screen
    testEndScreen: function (name, seconds) {
      var self = this;
      this.playerName = name || 'Lala';
      this.elapsedSeconds = seconds || 515; // 08:35 default (< 10 Menit = Sangat Cepat, Superior)

      var attempts = 0;
      var trySwitch = function () {
        var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
        if (rt && rt.layouts && rt.layouts['hasil akhir'] && !rt.isloading && rt.running_layout && rt.running_layout.name !== 'loading') {
          self.setC2Var('waktu', self.elapsedSeconds);
          self.setC2Var('NamaPemain', self.playerName);
          try {
            localStorage.setItem('NamaPemain', self.playerName);
            localStorage.setItem('WaktuTerbaik', self.elapsedSeconds.toString());
          } catch (e) {}

          if (rt.running_layout.name !== 'hasil akhir') {
            rt.changelayout = null;
            if (rt.doChangeLayout) {
              rt.doChangeLayout(rt.layouts['hasil akhir']);
            } else {
              rt.changelayout = rt.layouts['hasil akhir'];
            }
          }
        } else {
          attempts++;
          if (attempts < 80) {
            setTimeout(trySwitch, 250);
          }
        }
      };
      trySwitch();
    }
  };

  window.DetectiveEngine = DetectiveEngine;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      DetectiveEngine.init();
    });
  } else {
    DetectiveEngine.init();
  }
})();
