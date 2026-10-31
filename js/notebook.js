// notebook.js - floating draggable notebook window for player notes

export function createNotebook() {
  let winEl = null;
  let editorEl = null;
  let footerEl = null;
  let spookTimer = null;
  let visible = false;

  const entries = []; // {timestamp, text}

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function makeDraggable(win, header) {
    let grab = null;
    header.addEventListener('mousedown', (e) => {
      grab = { x: e.clientX - win.offsetLeft, y: e.clientY - win.offsetTop };
      e.preventDefault();
    });
    window.addEventListener('mouseup', () => { grab = null; });
    window.addEventListener('mousemove', (e) => {
      if (!grab) return;
      win.style.left = `${e.clientX - grab.x}px`;
      win.style.top = `${e.clientY - grab.y}px`;
    });
  }

  const nb = {
    entries,

    mount(containerEl) {
      winEl = el(`
        <article class="window notebook-window" aria-label="notebook" hidden>
          <header class="notebook-header">
            <span>my notebook</span>
            <button type="button" aria-label="close notebook">×</button>
          </header>
          <div class="body notebook-body">
            <div class="notes notebook-editor" contenteditable="true" spellcheck="false"
                 placeholder="write your notes here…"></div>
          </div>
          <footer class="notebook-footer">
            <span class="notebook-footer-text">the game does not read this</span>
          </footer>
        </article>
      `);

      editorEl = winEl.querySelector('.notebook-editor');
      footerEl = winEl.querySelector('.notebook-footer-text');
      const headerEl = winEl.querySelector('.notebook-header');
      const closeBtn = winEl.querySelector('header button');

      // draggable
      makeDraggable(winEl, headerEl);

      // snapshot entries on input
      editorEl.addEventListener('input', () => {
        entries.push({ timestamp: Date.now(), text: editorEl.textContent });
        if (entries.length > 50) entries.shift();
      });

      // close button
      closeBtn.addEventListener('click', () => nb.hide());

      containerEl.append(winEl);
    },

    show() {
      if (!winEl) return;
      winEl.hidden = false;
      visible = true;
      editorEl?.focus();
    },

    hide() {
      if (!winEl) return;
      winEl.hidden = true;
      visible = false;
    },

    toggle() {
      if (visible) nb.hide(); else nb.show();
    },

    isVisible() {
      return visible;
    },

    spook() {
      if (!footerEl) return;
      if (spookTimer) clearTimeout(spookTimer);
      footerEl.textContent = 'the game is watching';
      footerEl.classList.add('notebook-footer--spook');
      spookTimer = setTimeout(() => {
        footerEl.textContent = 'the game does not read this';
        footerEl.classList.remove('notebook-footer--spook');
        spookTimer = null;
      }, 3000);
    },

    markOutdated() {
      if (!editorEl) return;
      // mark the whole editor content with a strikethrough overlay text class
      // by wrapping current content in a span
      const currentText = editorEl.textContent.trim();
      if (!currentText) return;
      editorEl.classList.add('notebook-outdated');
      // remove after a second spook so player notices
      setTimeout(() => {
        editorEl.classList.remove('notebook-outdated');
      }, 6000);
    },
  };

  return nb;
}
