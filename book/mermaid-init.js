// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

(() => {
    const darkThemes = ['ayu', 'navy', 'coal'];
    const lightThemes = ['light', 'rust'];

    const classList = document.getElementsByTagName('html')[0].classList;

    let lastThemeWasLight = true;
    for (const cssClass of classList) {
        if (darkThemes.includes(cssClass)) {
            lastThemeWasLight = false;
            break;
        }
    }

    const theme = lastThemeWasLight ? 'default' : 'dark';
    mermaid.initialize({ startOnLoad: true, theme });

    // After mermaid renders, wrap each SVG with pan-zoom controls
    setTimeout(() => {
        document.querySelectorAll('.mermaid').forEach((container) => {
            const svg = container.querySelector('svg');
            if (!svg) return;

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative;overflow:hidden;border:1px solid rgba(128,128,128,0.3);border-radius:8px;margin:1em 0;cursor:grab;';
            wrapper.style.height = Math.min(svg.getBoundingClientRect().height + 40, 700) + 'px';

            // Create toolbar
            const toolbar = document.createElement('div');
            toolbar.style.cssText = 'position:absolute;top:8px;right:8px;z-index:10;display:flex;gap:4px;';
            toolbar.innerHTML = `
                <button class="pz-btn" data-action="zoomin" title="放大">+</button>
                <button class="pz-btn" data-action="zoomout" title="缩小">−</button>
                <button class="pz-btn" data-action="reset" title="重置">↺</button>
                <button class="pz-btn" data-action="fit" title="适应">⊡</button>
            `;

            container.parentNode.insertBefore(wrapper, container);
            wrapper.appendChild(toolbar);
            wrapper.appendChild(container);

            // Pan-zoom state
            let scale = 1, panX = 0, panY = 0, dragging = false, startX, startY;

            function applyTransform() {
                svg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
                svg.style.transformOrigin = '0 0';
            }

            // Mouse drag
            wrapper.addEventListener('mousedown', (e) => {
                if (e.target.closest('.pz-btn')) return;
                dragging = true;
                startX = e.clientX - panX;
                startY = e.clientY - panY;
                wrapper.style.cursor = 'grabbing';
                e.preventDefault();
            });
            window.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                panX = e.clientX - startX;
                panY = e.clientY - startY;
                applyTransform();
            });
            window.addEventListener('mouseup', () => {
                dragging = false;
                wrapper.style.cursor = 'grab';
            });

            // Scroll zoom
            wrapper.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = wrapper.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.min(Math.max(scale * delta, 0.2), 5);

                panX = mouseX - (mouseX - panX) * (newScale / scale);
                panY = mouseY - (mouseY - panY) * (newScale / scale);
                scale = newScale;
                applyTransform();
            }, { passive: false });

            // Toolbar buttons
            toolbar.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'zoomin') { scale = Math.min(scale * 1.3, 5); }
                if (action === 'zoomout') { scale = Math.max(scale * 0.7, 0.2); }
                if (action === 'reset') { scale = 1; panX = 0; panY = 0; }
                if (action === 'fit') {
                    const svgRect = svg.getBBox ? svg.getBBox() : svg.getBoundingClientRect();
                    const wrapRect = wrapper.getBoundingClientRect();
                    scale = Math.min(wrapRect.width / (svgRect.width || 800), wrapRect.height / (svgRect.height || 600)) * 0.9;
                    panX = (wrapRect.width - (svgRect.width || 800) * scale) / 2;
                    panY = (wrapRect.height - (svgRect.height || 600) * scale) / 2;
                }
                applyTransform();
            });
        });
    }, 500);

    // Theme switching
    for (const darkTheme of darkThemes) {
        document.getElementById(darkTheme).addEventListener('click', () => {
      if (lastThemeWasLight) { window.location.reload(); }
        });
    }
    for (const lightTheme of lightThemes) {
        document.getElementById(lightTheme).addEventListener('click', () => {
            if (!lastThemeWasLight) { window.location.reload(); }
        });
    }
})();
