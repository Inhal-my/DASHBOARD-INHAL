(function () {
  var STYLE_ID = 'dosen-picker-style';
  var CSS = [
    '.dp-wrap{position:relative}',
    '.dp-trigger{display:flex;align-items:center;gap:.5rem;width:100%;text-align:left;cursor:pointer}',
    '.dp-trigger:disabled{cursor:not-allowed;opacity:.55}',
    '.dp-trigger-text{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dp-placeholder{color:#94a3b8}',
    '.dp-chevron{flex:0 0 auto;color:#94a3b8;font-size:.8rem}',
    '.dp-badge{flex:0 0 auto;border-radius:9999px;background:#fff7ed;color:#c2410c;font-size:10px;font-weight:700;padding:1px 6px;white-space:nowrap}',
    '.dp-pop{position:absolute;left:0;right:0;z-index:140;margin-top:.25rem;border:1px solid #e2e8f0;border-radius:.75rem;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.16);overflow:hidden}',
    '.dp-search{width:100%;border:0;border-bottom:1px solid #e2e8f0;outline:none;padding:.5rem .75rem;font-size:.8rem}',
    '.dp-list{max-height:14rem;overflow-y:auto;padding:.25rem 0}',
    '.dp-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:.5rem;text-align:left;padding:.4rem .75rem;font-size:.78rem;color:#334155;background:transparent;border:0;cursor:pointer}',
    '.dp-option:hover,.dp-option.is-active{background:#eff6ff;color:#1d4ed8}',
    '.dp-option.is-selected{font-weight:700}',
    '.dp-empty{padding:.75rem;text-align:center;font-size:.75rem;color:#94a3b8}',
    '.dp-hint{padding:.35rem .75rem;font-size:10px;color:#94a3b8}',
    '.dp-clear{width:100%;border:0;border-top:1px solid #e2e8f0;background:#fff;padding:.45rem .75rem;text-align:left;font-size:.75rem;color:#e11d48;cursor:pointer}',
    '.dp-clear:hover{background:#fff1f2}',
    '@media (max-width:640px){.dp-list{max-height:40vh}}'
  ].join('');

  function normalize(v) {
    return String(v == null ? '' : v)
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function masterKeys(options) {
    var set = new Set();
    (Array.isArray(options) ? options : []).forEach(function (o) { set.add(normalize(o)); });
    return set;
  }

  function isMasterName(value, options) {
    if (!value) return true;
    return masterKeys(options).has(normalize(value));
  }

  var DosenPicker = {
    name: 'DosenPicker',
    props: {
      modelValue: { type: String, default: '' },
      options: { type: Array, default: function () { return []; } },
      placeholder: { type: String, default: 'Pilih dosen' },
      disabled: { type: Boolean, default: false },
      clearable: { type: Boolean, default: true }
    },
    emits: ['update:modelValue'],
    data: function () {
      return { open: false, query: '', active: -1 };
    },
    computed: {
      value: function () { return String(this.modelValue || '').trim(); },
      isMaster: function () { return isMasterName(this.value, this.options); },
      filtered: function () {
        var q = normalize(this.query);
        return (Array.isArray(this.options) ? this.options : [])
          .filter(function (o) { return !q || normalize(o).indexOf(q) !== -1; })
          .slice(0, 200);
      }
    },
    watch: {
      open: function (v) {
        if (!v) return;
        this.query = '';
        this.active = this.filtered.length ? 0 : -1;
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.search) self.$refs.search.focus();
        });
      },
      filtered: function () {
        if (this.active >= this.filtered.length) this.active = this.filtered.length ? 0 : -1;
      }
    },
    mounted: function () {
      var self = this;
      this.__outside = function (e) {
        if (!self.$el.contains(e.target)) self.close();
      };
      document.addEventListener('mousedown', this.__outside);
      if (!document.getElementById(STYLE_ID)) {
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
      }
    },
    beforeUnmount: function () {
      document.removeEventListener('mousedown', this.__outside);
    },
    methods: {
      norm: normalize,
      toggle: function () {
        if (this.disabled) return;
        this.open = !this.open;
      },
      close: function () { this.open = false; },
      choose: function (name) {
        this.$emit('update:modelValue', String(name || ''));
        this.open = false;
      },
      clear: function () {
        this.$emit('update:modelValue', '');
        this.open = false;
      },
      move: function (step) {
        if (!this.filtered.length) return;
        this.active = (this.active + step + this.filtered.length) % this.filtered.length;
      },
      onKeydown: function (e) {
        if (e.key === 'Escape') { this.close(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); return; }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.active >= 0 && this.filtered[this.active] !== undefined) {
            this.choose(this.filtered[this.active]);
          }
        }
      }
    },
    template: [
      '<div class="dp-wrap">',
      '  <button type="button" class="input dp-trigger" :disabled="disabled" role="combobox" :aria-expanded="open ? \'true\' : \'false\'" aria-haspopup="listbox" @click="toggle" @keydown.esc.prevent="close">',
      '    <span class="dp-trigger-text" :class="{ \'dp-placeholder\': !value }">{{ value || placeholder }}</span>',
      '    <span v-if="value && !isMaster" class="dp-badge">di luar master</span>',
      '    <i class="bi bi-chevron-down dp-chevron"></i>',
      '  </button>',
      '  <div v-if="open" class="dp-pop">',
      '    <input ref="search" v-model="query" class="dp-search" type="text" placeholder="Cari nama dosen..." aria-label="Cari nama dosen" @keydown="onKeydown">',
      '    <div class="dp-list" role="listbox">',
      '      <button v-for="(o, i) in filtered" :key="o" type="button" role="option" :aria-selected="norm(o) === norm(value) ? \'true\' : \'false\'" class="dp-option" :class="{ \'is-active\': i === active, \'is-selected\': norm(o) === norm(value) }" @mouseenter="active = i" @click="choose(o)">',
      '        <span>{{ o }}</span>',
      '        <i v-if="norm(o) === norm(value)" class="bi bi-check2"></i>',
      '      </button>',
      '      <div v-if="!filtered.length" class="dp-empty">Tidak ada dosen yang cocok.</div>',
      '    </div>',
      '    <div v-if="value && !isMaster" class="dp-hint">Nama ini tidak ada di master. Pilih ulang dari daftar bila perlu.</div>',
      '    <button v-if="value && clearable" type="button" class="dp-clear" @click="clear">Kosongkan pilihan</button>',
      '  </div>',
      '</div>'
    ].join('')
  };

  function install(app) {
    app.component('dosen-picker', DosenPicker);
  }

  window.DosenPicker = {
    install: install,
    component: DosenPicker,
    normalize: normalize,
    isMaster: isMasterName
  };
})();
