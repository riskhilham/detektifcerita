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
    misiBgm: null,
    isMissionBgmPlaying: false,

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
      this.setupResponsiveHUD();
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

    // =========================================================================
    // MISSION BGM SYSTEM ('media/bgm_misi.ogg')
    // Automatically loops during Missions 1 to 10 and stops on menu / endscreen
    // Respects in-game mute toggle (C2 'backsound' variable)
    // =========================================================================
    playMisiBgm: function () {
      this.isMissionBgmPlaying = true;
      this.stopC2Bgm();

      if (!this.misiBgm) {
        this.misiBgm = new Audio('media/bgm_misi.ogg');
        this.misiBgm.loop = true;
      }

      var isMuted = (this.getC2Var('backsound') === 1);
      this.misiBgm.muted = isMuted;
      this.misiBgm.volume = isMuted ? 0 : 0.6;

      if (this.misiBgm.paused) {
        var p = this.misiBgm.play();
        if (p && p.catch) p.catch(function () {});
      }
    },

    stopMisiBgm: function () {
      this.isMissionBgmPlaying = false;
      if (this.misiBgm) {
        try {
          this.misiBgm.pause();
          this.misiBgm.currentTime = 0;
        } catch (e) {}
      }
    },

    stopC2Bgm: function () {
      try {
        var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
        if (rt && rt.types_by_index) {
          for (var i = 0; i < rt.types_by_index.length; i++) {
            var t = rt.types_by_index[i];
            if (t && t.plugin && window.cr && window.cr.plugins_ && t.plugin instanceof window.cr.plugins_.Audio) {
              if (t.instances && t.instances[0]) {
                window.cr.plugins_.Audio.prototype.acts.SetPaused.call(t.instances[0], "bgm", 0);
              }
            }
          }
        }
      } catch (e) {}
      var allAudios = document.querySelectorAll('audio');
      for (var a = 0; a < allAudios.length; a++) {
        if (allAudios[a] !== this.misiBgm && allAudios[a].src && allAudios[a].src.indexOf('fix,bgm') !== -1) {
          try { allAudios[a].pause(); } catch (e) {}
        }
      }
    },

    resumeC2Bgm: function () {
      var isMuted = (this.getC2Var('backsound') === 1);
      if (isMuted) return;
      try {
        var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
        if (rt && rt.types_by_index) {
          for (var i = 0; i < rt.types_by_index.length; i++) {
            var t = rt.types_by_index[i];
            if (t && t.plugin && window.cr && window.cr.plugins_ && t.plugin instanceof window.cr.plugins_.Audio) {
              if (t.instances && t.instances[0]) {
                window.cr.plugins_.Audio.prototype.acts.SetPaused.call(t.instances[0], "bgm", 1);
              }
            }
          }
        }
      } catch (e) {}
    },

    syncBgmVolume: function () {
      if (this.misiBgm) {
        var isMuted = (this.getC2Var('backsound') === 1);
        this.misiBgm.muted = isMuted;
        this.misiBgm.volume = isMuted ? 0 : 0.6;
      }
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
        if (self.isMissionBgmPlaying) {
          self.syncBgmVolume();
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

      var self = this;
      if (name && name.toLowerCase() === 'backsound') {
        setTimeout(function () { self.syncBgmVolume(); }, 50);
      }

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
          rt.fullscreen_mode = 4;
          rt.fullscreen_scaling = 4;
          self.attachRuntimeHooks(rt);
        }
      }, 50);
    },

    attachRuntimeHooks: function (rt) {
      var self = this;
      var proto = Object.getPrototypeOf(rt);
      if (proto._detektifHooked) return;
      proto._detektifHooked = true;
      rt.fullscreen_mode = 4;
      rt.fullscreen_scaling = 4;
      var origDoChangeLayout = proto.doChangeLayout;

      // Hook C2 Audio plugin to prevent C2 from playing default bgm during missions
      try {
        if (window.cr && window.cr.plugins_ && window.cr.plugins_.Audio) {
          var audioProto = window.cr.plugins_.Audio.prototype;
          if (audioProto && audioProto.acts && !audioProto.acts._detektifAudioHooked) {
            audioProto.acts._detektifAudioHooked = true;
            var origPlay = audioProto.acts.Play;
            audioProto.acts.Play = function (file, looping, vol, tag) {
              if (self.isMissionBgmPlaying && tag === 'bgm') {
                return; // Suppress default menu BGM while on missions
              }
              return origPlay.apply(this, arguments);
            };

            var origSetMuted = audioProto.acts.SetMuted;
            audioProto.acts.SetMuted = function (tag, muted) {
              var res = origSetMuted.apply(this, arguments);
              self.syncBgmVolume();
              return res;
            };
          }
        }
      } catch (e) {}

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
          self.resetAllMissionProgress();
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
          if (self.updateHUDLayout) self.updateHUDLayout();
        }, 50);
      };

      // Hook C2 setSize to keep HUD perfectly responsive when window/viewport resizes
      var origSetSize = proto.setSize;
      if (origSetSize) {
        proto.setSize = function (w, h, force) {
          origSetSize.apply(this, arguments);
          if (self.updateHUDLayout) self.updateHUDLayout();
        };
      }

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

      // Hook C2 TextBox plugin to prevent C2 from overriding responsive font sizes with giant em values
      try {
        if (window.cr && window.cr.plugins_ && window.cr.plugins_.TextBox) {
          var tbProto = window.cr.plugins_.TextBox.prototype.Instance.prototype;
          if (tbProto && !tbProto._detektifHooked) {
            tbProto._detektifHooked = true;
            var origUpdatePosition = tbProto.updatePosition;
            tbProto.updatePosition = function () {
              this.autoFontSize = false;
              origUpdatePosition.apply(this, arguments);
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
      this.closeGameAlert();
      this.closeModal('leaderboard-modal');
      this.closeModal('certificate-modal');

      // Clear any stuck touches from Touch plugin across layout switches
      if (window.cr_getC2Runtime) {
        try {
          var rt = window.cr_getC2Runtime();
          if (rt && rt.types_by_index) {
            for (var ti = 0; ti < rt.types_by_index.length; ti++) {
              var tObj = rt.types_by_index[ti];
              if (tObj && tObj.instances) {
                for (var ii = 0; ii < tObj.instances.length; ii++) {
                  var inst = tObj.instances[ii];
                  if (inst && inst.touches) {
                    inst.touches.length = 0;
                    inst.mouseDown = false;
                  }
                }
              }
            }
          }
        } catch (e) {}
      }

      if (this.updateHUDLayout) this.updateHUDLayout();

      var playerHud = document.getElementById('game-hud-player');
      var actionsHud = document.getElementById('game-hud-actions');

      if (!playerHud || !actionsHud) {
        this.injectHUD();
        playerHud = document.getElementById('game-hud-player');
        actionsHud = document.getElementById('game-hud-actions');
      }

      var isGameplay = (layoutName.indexOf('misi ') === 0 || 
                        layoutName.indexOf('jawaban pg') === 0 || 
                        layoutName.indexOf('pilihan ganda') === 0 ||
                        layoutName.indexOf('feedback') === 0);
      var isMainMenu = (layoutName === 'main menu' || layoutName === 'main menu 2');
      var isResults = (layoutName === 'hasil akhir');
      var isPetunjuk = (layoutName.indexOf('petunjuk') === 0);
      var isHiddenScreen = (layoutName === 'loading' || 
                            layoutName === 'loading+judul' || 
                            layoutName === 'identitas pengguna' || 
                            layoutName.indexOf('video') === 0);

      // 3. Audio Router: Mission BGM ('media/bgm_misi.ogg') vs Default Menu BGM
      if (isGameplay) {
        this.playMisiBgm();
      } else {
        if (this.isMissionBgmPlaying) {
          this.stopMisiBgm();
        }
        if (isMainMenu) {
          this.resumeC2Bgm();
        }
      }

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
        // Gameplay (Misi 1 - 10, dsb): Sembunyikan tombol Papan Skor (hanya ada di akhir & beranda), Pertahankan tombol Nama Detektif
        if (actionsHud) {
          actionsHud.style.display = 'flex';
          actionsHud.classList.add('hud-no-scoreboard');
        }
        // Nama Pemain di pojok kiri bawah: DIPERTAHANKAN saat misi berlangsung
        if (playerHud) {
          var activeName = this.playerName || this.getC2Var('namapemain') || localStorage.getItem('NamaPemain') || 'Detektif';
          if (activeName && activeName.trim().length > 0) {
            this.playerName = activeName.trim();
          }
          playerHud.style.display = 'flex';
          this.updateHUDPlayer();
        }
      } else if (isMainMenu) {
        // Beranda: Papan Skor & Fullscreen tampil di pojok kanan bawah
        if (actionsHud) {
          actionsHud.style.display = 'flex';
          actionsHud.classList.remove('hud-no-scoreboard');
        }
        // Di Beranda: Sembunyikan badge nama karena pemain belum mengisi identitas
        if (playerHud) {
          playerHud.style.display = 'none';
        }
      } else if (isPetunjuk) {
        // 1 & 2: Halaman Petunjuk Tombol & Petunjuk Permainan:
        // HILANGKAN TOMBOL NAMA dan HILANGKAN TOMBOL PAPAN SKOR (Hanya tombol Fullscreen jika ada)
        if (actionsHud) {
          actionsHud.style.display = 'flex';
          actionsHud.classList.add('hud-no-scoreboard');
        }
        if (playerHud) {
          playerHud.style.display = 'none';
        }
      } else {
        // Menu pendukung lainnya (materi, tujuan, informasi, profil)
        if (actionsHud) {
          actionsHud.style.display = 'flex';
          actionsHud.classList.add('hud-no-scoreboard');
          actionsHud.classList.remove('hud-shift-misi-alur');
        }
        // Sembunyikan badge nama di menu pendukung agar tampilan bersih
        if (playerHud) {
          playerHud.style.display = 'none';
        }
      }

      // If on 'identitas pengguna', enhance input element and reset progress
      if (layoutName === 'identitas pengguna') {
        this.playerName = '';
        this.updateHUDPlayer();
        this.resetAllMissionProgress();
        this.enhanceNameInput();
      }

      // If returning to main menu, reset all mission progress
      if (layoutName === 'main menu' || layoutName === 'main menu 2') {
        this.resetAllMissionProgress();
      }

      // When starting any mission layout, ensure its progress is pristine
      if (layoutName.indexOf('misi ') === 0) {
        this.completedMissions[layoutName] = false;
        var mTarget = this.missionTargets[layoutName];
        if (mTarget) {
          var curVal = this.getC2Var(mTarget.varName);
          if (curVal === null || curVal >= mTarget.target) {
            this.setC2Var(mTarget.varName, 0);
          }
        }
      }
    },

    // Name Input Enhancement - Fits perfectly inside the pre-drawn parchment pill capsule
    enhanceNameInput: function () {
      var self = this;
      var attempts = 0;
      var interval = setInterval(function () {
        attempts++;
        var input = document.querySelector('#c2canvasdiv input, input[type="text"], input');
        if (input) {
          clearInterval(interval);

          // Position C2 TextBox instance directly over the pre-drawn pill capsule in layout coordinates (1708x960)
          // The background image pill text zone is X: 640 to 1227, Y: 480 to 595
          try {
            var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
            if (rt && rt.types_by_index) {
              for (var i = 0; i < rt.types_by_index.length; i++) {
                var t = rt.types_by_index[i];
                if (t && t.plugin && (t.plugin.id === 5 || t.name === 't195')) {
                  if (t.instances) {
                    for (var j = 0; j < t.instances.length; j++) {
                      var inst = t.instances[j];
                      inst.autoFontSize = false;
                      inst.x = 640;
                      inst.y = 480;
                      inst.width = 580;
                      inst.height = 115;
                      inst.set_bbox_changed();
                      if (inst.updatePosition) inst.updatePosition();
                    }
                  }
                }
              }
            }
          } catch (e) {}

          var isMobile = (window.innerWidth <= 600) || (window.innerHeight > window.innerWidth);
          input.value = '';
          input.setAttribute('placeholder', isMobile ? 'Ketik nama detektif...' : 'Ketik nama detektif...');
          input.setAttribute('maxlength', '20');
          input.setAttribute('autocomplete', 'off');
          input.setAttribute('spellcheck', 'false');
          input.classList.add('c2-input-name');

          // Styling seamlessly integrates with the pre-drawn parchment capsule (no awkward white box!)
          input.style.setProperty('background', 'transparent', 'important');
          input.style.setProperty('border', 'none', 'important');
          input.style.setProperty('box-shadow', 'none', 'important');
          input.style.setProperty('outline', 'none', 'important');
          input.style.setProperty('border-radius', '999px', 'important');
          input.style.setProperty('text-align', 'left', 'important');
          input.style.setProperty('font-family', 'var(--font-game), cursive, sans-serif', 'important');
          input.style.setProperty('font-weight', '800', 'important');
          input.style.setProperty('color', '#3a1c07', 'important');
          input.style.setProperty('caret-color', '#8b5a2b', 'important');
          input.style.setProperty('letter-spacing', '1.5px', 'important');

          if (isMobile) {
            input.style.setProperty('font-size', 'clamp(22px, 5.0vw, 30px)', 'important');
            input.style.setProperty('padding', '2px 10px 2px 12px', 'important');
            input.style.setProperty('line-height', 'normal', 'important');
          } else {
            input.style.setProperty('font-size', 'clamp(28px, 3.8vw, 52px)', 'important');
            input.style.setProperty('padding', '4px 18px 4px clamp(16px, 2.0vw, 28px)', 'important');
          }

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
        if (attempts > 30) clearInterval(interval);
      }, 50);
    },

    // Canvas click & touch interception for guidance on 'Next' button
    setupCanvasInteractions: function () {
      var self = this;
      var canvas = document.getElementById('c2canvas');
      if (!canvas) return;

      var lastTriggerTime = 0;

      function checkInteraction(e) {
        if (!self.currentLayoutName) return;
        if (self.currentLayoutName.indexOf('misi ') !== 0) return;

        var config = self.missionTargets[self.currentLayoutName];
        if (!config) return;

        var touch = (e.changedTouches && e.changedTouches.length > 0)
          ? e.changedTouches[0]
          : ((e.touches && e.touches.length > 0) ? e.touches[0] : e);

        var clientX = touch.clientX;
        var clientY = touch.clientY;
        if (clientX === undefined || clientY === undefined) return;

        var rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        // Translate client tap/click to Construct 2's native 1708 x 960 layout coordinates
        var layoutX = (clientX - rect.left) * (1708 / rect.width);
        var layoutY = (clientY - rect.top) * (960 / rect.height);

        var isHit = false;
        // In missions 1-6, 'button_next' is located around (1622, 67), width: 205, height: 117
        if (layoutX >= 1480 && layoutX <= 1730 && layoutY >= 0 && layoutY <= 150) {
          isHit = true;
        }
        // In missions 7-10, 'button_selanjutnya' is located around (1500, 897), width: 326, height: 67
        else if (layoutX >= 1300 && layoutX <= 1700 && layoutY >= 840 && layoutY <= 960) {
          isHit = true;
        }

        if (isHit) {
          var currentVal = self.getC2Var(config.varName) || 0;
          if (currentVal < config.target) {
            self.completedMissions[self.currentLayoutName] = false;
            var now = Date.now();
            if (now - lastTriggerTime < 600) return;
            lastTriggerTime = now;
            self.triggerMissionWarning(self.currentLayoutName, currentVal, config.target);
          }
        }
      }

      // Listen on capture phase to ensure mobile touch and mouse events are intercepted
      canvas.addEventListener('touchend', checkInteraction, { capture: true, passive: true });
      canvas.addEventListener('pointerup', checkInteraction, { capture: true, passive: true });
      canvas.addEventListener('click', checkInteraction, true);
    },

    // Prominent Game Modal Alert System (bagus & kelihatan)
    injectGameAlertModal: function () {
      if (document.getElementById('game-alert-modal')) return;

      var modal = document.createElement('div');
      modal.id = 'game-alert-modal';
      modal.className = 'game-alert-modal-backdrop';
      modal.style.display = 'none';
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
      var closeFunc = function (e) {
        if (e && e.type === 'touchend') e.preventDefault();
        self.playSound('click');
        self.closeGameAlert();
      };

      var btnClose = document.getElementById('btn-close-alert');
      var btnOk = document.getElementById('btn-ok-alert');
      if (btnClose) {
        btnClose.onclick = closeFunc;
        btnClose.addEventListener('touchend', closeFunc, { passive: false });
      }
      if (btnOk) {
        btnOk.onclick = closeFunc;
        btnOk.addEventListener('touchend', closeFunc, { passive: false });
      }

      modal.onclick = function (e) {
        if (e.target === modal) closeFunc(e);
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

      modal.style.display = 'flex';
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
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
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

        // 2. Alarm Clock slot: Total Time Banner & Value
        '<div class="result-card-banner result-banner-clock">Total Waktu</div>' +
        '<div class="result-card-val result-val-clock">' +
          '<div class="result-time-num">' + record.timeFormatted + '</div>' +
          '<div class="result-time-unit">menit : detik</div>' +
        '</div>' +

        // 3. Speedometer slot: Time Category Banner & Value
        '<div class="result-card-banner result-banner-speedo">Kategori Waktu</div>' +
        '<div class="result-card-val result-val-speedo">' +
          '<div class="result-category-text">' + record.category + '</div>' +
        '</div>' +

        // 4. Medal slot: Predicate Banner & Value
        '<div class="result-card-banner result-banner-medal">Predikat</div>' +
        '<div class="result-card-val result-val-medal">' +
          '<div class="result-predicate-text">' + record.predTitle + '</div>' +
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

      // Dynamically compute canvas dimensions for proportional scaling
      var updateOverlayDims = function () {
        if (!container || !overlay) return;
        var ch = container.offsetHeight || window.innerHeight;
        var cw = container.offsetWidth || window.innerWidth;
        overlay.style.setProperty('--game-ch', ch + 'px');
        overlay.style.setProperty('--game-cw', cw + 'px');
      };
      updateOverlayDims();
      window.addEventListener('resize', updateOverlayDims);
      this._endOverlayResizeListener = updateOverlayDims;

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
        self.resetAllMissionProgress();
        self.goToLayout('main menu');
      };
    },

    removeHasilAkhirOverlay: function () {
      if (this._endOverlayResizeListener) {
        window.removeEventListener('resize', this._endOverlayResizeListener);
        this._endOverlayResizeListener = null;
      }
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

    resetAllMissionProgress: function () {
      this.completedMissions = {};
      for (var m in this.missionTargets) {
        if (this.missionTargets.hasOwnProperty(m)) {
          this.setC2Var(this.missionTargets[m].varName, 0);
        }
      }
      this.setC2Var('waktu', 0);
      this.elapsedSeconds = 0;
      this.isGameActive = false;
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      console.log('🔄 All mission progress, variables, and timer reset to 0');
    },

    restartGame: function () {
      this.resetAllMissionProgress();
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
      var btnLb = document.getElementById('hud-btn-lb');
      if (btnLb) {
        var triggerLb = function (e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          self.playSound('click');
          self.openModal('leaderboard-modal');
        };
        btnLb.onclick = triggerLb;
      }

      var btnFs = document.getElementById('hud-btn-fs');
      if (btnFs) {
        var fsClickLock = false;
        var triggerFs = function (e) {
          if (e) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault && e.type !== 'touchstart') e.preventDefault();
          }
          if (fsClickLock) return;
          fsClickLock = true;
          setTimeout(function () { fsClickLock = false; }, 400);
          self.playSound('click');
          self.toggleFullscreen();
        };
        btnFs.onclick = triggerFs;
        btnFs.addEventListener('touchend', triggerFs, { passive: false });
        btnFs.addEventListener('pointerdown', function (e) { if (e && e.stopPropagation) e.stopPropagation(); });
        btnFs.addEventListener('touchstart', function (e) { if (e && e.stopPropagation) e.stopPropagation(); });
      }

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
      var self = this;
      var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      var isSimulated = document.body.classList.contains('fullscreen-simulated');

      var updateFsIcon = function (active) {
        var fsBtn = document.getElementById('hud-btn-fs');
        if (fsBtn) {
          fsBtn.innerHTML = active ? '<span class="hud-fs-icon">🗗</span>' : '<span class="hud-fs-icon">⛶</span>';
          fsBtn.title = active ? 'Keluar Layar Penuh' : 'Layar Penuh';
        }
      };

      var triggerRuntimeResize = function () {
        if (rt && rt.setSize) {
          rt.fullscreen_mode = 4;
          rt.fullscreen_scaling = 4;
          var w = window.innerWidth;
          var h = window.innerHeight;
          rt.setSize(w, h, true);
          setTimeout(function () { if (rt && rt.setSize) rt.setSize(window.innerWidth, window.innerHeight, true); }, 80);
          setTimeout(function () { if (rt && rt.setSize) rt.setSize(window.innerWidth, window.innerHeight, true); }, 220);
          setTimeout(function () { if (rt && rt.setSize) rt.setSize(window.innerWidth, window.innerHeight, true); }, 450);
        }
        if (self.updateHUDLayout) self.updateHUDLayout();
      };

      if (!isFs && !isSimulated) {
        var el = document.documentElement || document.body;
        var rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        var handled = false;
        if (rfs) {
          try {
            var promise = rfs.call(el);
            if (promise && typeof promise.then === 'function') {
              handled = true;
              promise.then(function () {
                updateFsIcon(true);
                triggerRuntimeResize();
              }).catch(function (err) {
                console.warn('Native fullscreen rejected, using fallback:', err);
                self.toggleSimulatedFullscreen(true);
                updateFsIcon(true);
              });
            } else {
              handled = true;
              updateFsIcon(true);
              triggerRuntimeResize();
            }
          } catch (e) {
            console.warn('Native requestFullscreen failed:', e);
          }
        }
        if (!handled) {
          self.toggleSimulatedFullscreen(true);
          updateFsIcon(true);
        }
      } else {
        if (isFs) {
          var efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
          if (efs) {
            try {
              var exitPromise = efs.call(document);
              if (exitPromise && typeof exitPromise.then === 'function') {
                exitPromise.then(function () {
                  updateFsIcon(false);
                  triggerRuntimeResize();
                }).catch(function () {});
              } else {
                updateFsIcon(false);
                triggerRuntimeResize();
              }
            } catch (e) {}
          }
        }
        if (isSimulated) {
          self.toggleSimulatedFullscreen(false);
          updateFsIcon(false);
        }
      }
    },

    toggleSimulatedFullscreen: function (enable) {
      var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
      if (enable) {
        document.body.classList.add('fullscreen-simulated');
      } else {
        document.body.classList.remove('fullscreen-simulated');
      }
      if (rt && rt.setSize) {
        rt.fullscreen_mode = 4;
        rt.fullscreen_scaling = 4;
        setTimeout(function () {
          rt.setSize(window.innerWidth, window.innerHeight, true);
        }, 60);
        setTimeout(function () {
          rt.setSize(window.innerWidth, window.innerHeight, true);
        }, 220);
      }
      if (this.updateHUDLayout) {
        this.updateHUDLayout();
      }
    },

    // Dynamic Responsive Layout Manager for Mobile Screens & Orientation
    setupResponsiveHUD: function () {
      var self = this;
      this.updateHUDLayout = function () {
        var isPortrait = window.innerHeight >= window.innerWidth;
        var canvas = document.getElementById('c2canvas');
        var canvasDiv = document.getElementById('c2canvasdiv');
        var w = canvas ? canvas.offsetWidth : window.innerWidth;
        var h = canvas ? canvas.offsetHeight : window.innerHeight;
        var ratio = window.innerWidth / (window.innerHeight || 1);

        // Portrait or vertically letterboxed screen (ratio <= 1.35)
        var isLetterboxPortrait = isPortrait || (ratio <= 1.35);

        var targetElements = [canvasDiv, document.body];
        targetElements.forEach(function (el) {
          if (!el) return;
          if (isLetterboxPortrait) {
            el.classList.add('hud-portrait');
            el.classList.remove('hud-landscape');
          } else {
            el.classList.add('hud-landscape');
            el.classList.remove('hud-portrait');
          }
          if (w <= 860 || window.innerWidth <= 860) {
            el.classList.add('hud-mobile');
          } else {
            el.classList.remove('hud-mobile');
          }
        });

        // Ensure C2 maintains letterbox fit in fullscreen or resize
        var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
        if (rt && (document.fullscreenElement || document.webkitFullscreenElement)) {
          rt.fullscreen_mode = 4;
          rt.fullscreen_scaling = 4;
        }
      };

      window.addEventListener('resize', this.updateHUDLayout, { passive: true });
      window.addEventListener('orientationchange', function () {
        setTimeout(self.updateHUDLayout, 100);
        setTimeout(self.updateHUDLayout, 300);
      });
      var fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
      fsEvents.forEach(function (ev) {
        document.addEventListener(ev, function () {
          var isNowFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
          var fsBtn = document.getElementById('hud-btn-fs');
          if (fsBtn) {
            fsBtn.innerHTML = isNowFs ? '<span class="hud-fs-icon">🗗</span>' : '<span class="hud-fs-icon">⛶</span>';
            fsBtn.title = isNowFs ? 'Keluar Layar Penuh' : 'Layar Penuh';
          }
          var rt = window.cr_getC2Runtime ? window.cr_getC2Runtime() : null;
          if (rt && rt.setSize) {
            rt.fullscreen_mode = 4;
            rt.fullscreen_scaling = 4;
            rt.setSize(window.innerWidth, window.innerHeight, true);
          }
          setTimeout(self.updateHUDLayout, 100);
          setTimeout(self.updateHUDLayout, 300);
        });
      });

      this.updateHUDLayout();
      setTimeout(this.updateHUDLayout, 100);
      setTimeout(this.updateHUDLayout, 400);
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
      lbModal.style.display = 'none';
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
      certModal.style.display = 'none';
      certModal.innerHTML =
        '<div class="detective-modal-card">' +
          '<div class="modal-header">' +
            '<h2 class="modal-title">📜 Piagam Lencana Detektif</h2>' +
            '<div style="display:flex;gap:8px;">' +
              '<button class="corner-btn" id="btn-print-cert" title="Cetak Piagam Ukuran A4 Landscape" style="width:auto;border-radius:999px;padding:0 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;">🖨️ Cetak Piagam (A4 Landscape)</button>' +
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
        document.body.classList.add('is-printing-cert');
        setTimeout(function () {
          window.print();
        }, 50);
        window.onafterprint = function () {
          document.body.classList.remove('is-printing-cert');
        };
        setTimeout(function () {
          document.body.classList.remove('is-printing-cert');
        }, 2000);
      };
    },

    openModal: function (id) {
      if (id === 'leaderboard-modal') {
        this.renderLeaderboard();
      } else if (id === 'certificate-modal') {
        this.renderCertificate();
      }
      var el = document.getElementById(id);
      if (el) {
        el.style.display = 'flex';
        el.classList.add('active');
      }
    },

    closeModal: function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.remove('active');
        el.style.display = 'none';
      }
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
        '<div class="lb-clear-row">' +
          '<button id="btn-clear-lb" class="btn-clear-history">' +
            '🗑️ Hapus Riwayat Detektif' +
          '</button>' +
        '</div>';

      body.innerHTML = html;

      var self = this;
      var clearBtn = document.getElementById('btn-clear-lb');
      if (clearBtn) {
        var onClearClick = function (e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          self.playSound('click');
          self.showClearConfirmDialog();
        };
        clearBtn.onclick = onClearClick;
        clearBtn.addEventListener('touchend', onClearClick, { passive: false });
      }
    },

    showClearConfirmDialog: function () {
      var self = this;
      var existing = document.getElementById('confirm-clear-modal');
      if (existing) {
        existing.remove();
      }

      var modal = document.createElement('div');
      modal.id = 'confirm-clear-modal';
      modal.className = 'detective-modal-backdrop confirm-clear-backdrop active';
      modal.style.display = 'flex';
      modal.innerHTML =
        '<div class="detective-modal-card confirm-modal-card">' +
          '<div class="confirm-modal-icon">⚠️</div>' +
          '<h3 class="confirm-modal-title">Hapus Riwayat Detektif?</h3>' +
          '<p class="confirm-modal-desc">Seluruh data riwayat permainan, rekor waktu, dan peringkat yang tersimpan akan dihapus secara permanen. Apakah kamu yakin?</p>' +
          '<div class="confirm-modal-actions">' +
            '<button class="confirm-btn confirm-btn-cancel" id="btn-cancel-clear">Batal</button>' +
            '<button class="confirm-btn confirm-btn-danger" id="btn-action-clear">Ya, Hapus</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(modal);

      var closeModal = function () {
        modal.classList.remove('active');
        modal.style.display = 'none';
        setTimeout(function () {
          if (modal.parentNode) modal.parentNode.removeChild(modal);
        }, 220);
      };

      var btnCancel = document.getElementById('btn-cancel-clear');
      if (btnCancel) {
        var onCancel = function (e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          self.playSound('click');
          closeModal();
        };
        btnCancel.onclick = onCancel;
        btnCancel.addEventListener('touchend', onCancel, { passive: false });
      }

      var btnAction = document.getElementById('btn-action-clear');
      if (btnAction) {
        var onAction = function (e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          self.playSound('success');
          self.history = [];
          try {
            localStorage.removeItem('detektif_cerita_history');
          } catch (err) {}
          closeModal();
          self.renderLeaderboard();
        };
        btnAction.onclick = onAction;
        btnAction.addEventListener('touchend', onAction, { passive: false });
      }

      modal.onclick = function (e) {
        if (e.target === modal) {
          closeModal();
        }
      };
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
        dateStr: new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      });

      var starsStr = '';
      for (var i = 0; i < (res.stars || 5); i++) {
        starsStr += '<span class="cert-star">★</span> ';
      }

      var regCode = 'REG-DET/' + (res.id ? String(res.id).slice(-6) : '202601') + '/' + (res.predicate || 'SUP').toUpperCase().slice(0, 3);
      var verifyCode = 'DET-' + (res.predicate || 'SUPERIOR').toUpperCase() + '-VERIFIED';

      body.innerHTML =
        '<div class="cert-card-a4" id="cert-printable-card">' +
          '<div class="cert-corner-ornament cert-corner-tl">⚜️</div>' +
          '<div class="cert-corner-ornament cert-corner-tr">⚜️</div>' +
          '<div class="cert-corner-ornament cert-corner-bl">⚜️</div>' +
          '<div class="cert-corner-ornament cert-corner-br">⚜️</div>' +
          '<div class="cert-inner-frame">' +
            '<div class="cert-gold-divider top-ornament">' +
              '<span class="cert-divider-line"></span>' +
              '<span class="cert-divider-diamond">⚜️ ◆ ✦ ◆ ⚜️</span>' +
              '<span class="cert-divider-line"></span>' +
            '</div>' +
            '<div class="cert-main-title">PIAGAM PENGHARGAAN</div>' +
            '<div class="cert-honor-title">LENCANA DETEKTIF SASTRA INDONESIA</div>' +
            '<div class="cert-recipient-preamble">Diberikan secara resmi dan penuh kehormatan kepada:</div>' +
            '<div class="cert-recipient-name">' + this.escapeHtml(res.name) + '</div>' +
            '<div class="cert-name-underline"></div>' +
            '<div class="cert-citation">' +
              'Telah berhasil menuntaskan seluruh <strong>10 Misi Investigasi Kasus Detektif Cerita</strong> dengan ketelitian analisa, penalaran deduktif yang tajam, serta pemahaman unsur intrinsik sastra yang unggul.' +
            '</div>' +
            '<div class="cert-matrix-row">' +
              '<div class="cert-matrix-col">' +
                '<div class="cert-plaque">' +
                  '<div class="cert-plaque-icon">⏱️</div>' +
                  '<div class="cert-plaque-label">WAKTU INVESTIGASI</div>' +
                  '<div class="cert-plaque-val">' + res.timeFormatted + '</div>' +
                  '<div class="cert-plaque-sub">' + res.timeText + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="cert-matrix-col">' +
                '<div class="cert-plaque cert-plaque-speed">' +
                  '<div class="cert-plaque-icon">⚡</div>' +
                  '<div class="cert-plaque-label">KATEGORI WAKTU</div>' +
                  '<div class="cert-plaque-val">' + res.category + '</div>' +
                  '<div class="cert-plaque-sub">Investigasi Cekatan</div>' +
                '</div>' +
              '</div>' +
              '<div class="cert-matrix-col">' +
                '<div class="cert-plaque cert-plaque-pred">' +
                  '<div class="cert-plaque-icon">🏅</div>' +
                  '<div class="cert-plaque-label">PREDIKAT KELULUSAN</div>' +
                  '<div class="cert-plaque-val">' + (res.predTitle || res.predicate) + '</div>' +
                  '<div class="cert-plaque-sub">Kecakapan Sastra Unggul</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="cert-stars-row">' +
              starsStr +
            '</div>' +
            '<div class="cert-footer-grid">' +
              '<div class="cert-footer-col cert-foot-left">' +
                '<div class="cert-foot-meta-title">INFORMASI KELULUSAN</div>' +
                '<div class="cert-foot-date">Tanggal: <strong>' + res.dateStr + '</strong></div>' +
                '<div class="cert-foot-reg">No. Reg: <strong>' + regCode + '</strong></div>' +
                '<div class="cert-foot-inst">Media Pembelajaran: Detektif Cerita</div>' +
              '</div>' +
              '<div class="cert-footer-col cert-foot-center">' +
                '<div class="cert-gold-seal">' +
                  '<div class="cert-seal-outer">' +
                    '<div class="cert-seal-inner">' +
                      '<span class="cert-seal-star">★</span>' +
                      '<span class="cert-seal-text">TERVERIFIKASI</span>' +
                      '<span class="cert-seal-year">RESMI</span>' +
                    '</div>' +
                  '</div>' +
                  '<div class="cert-ribbon-tail left"></div>' +
                  '<div class="cert-ribbon-tail right"></div>' +
                '</div>' +
              '</div>' +
              '<div class="cert-footer-col cert-foot-right">' +
                '<div class="cert-foot-status-badge">✓ TERVERIFIKASI & SAH</div>' +
                '<div class="cert-foot-sign-role">Tim Validasi & Pengembang Media</div>' +
                '<div class="cert-foot-sign-org">Media Detektif Cerita Interaktif</div>' +
                '<div class="cert-foot-hash">KODE: ' + verifyCode + '</div>' +
              '</div>' +
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
