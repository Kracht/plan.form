// ── UI · DMT slider + reset ───────────────────────────────────────────────────

export function createUI(onDMTChange, onReset) {
  const style = document.createElement('style')
  style.textContent = `
    #controls {
      position: fixed;
      bottom: 2.4rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 1rem;
      font-family: 'Courier New', monospace;
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      color: rgba(255,255,255,0.45);
      user-select: none;
      pointer-events: all;
    }

    #controls label {
      text-transform: uppercase;
      white-space: nowrap;
    }

    #dmt-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 200px;
      height: 2px;
      background: rgba(255,255,255,0.15);
      outline: none;
      cursor: pointer;
    }

    #dmt-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgba(255,255,255,0.75);
      cursor: pointer;
      transition: background 0.15s;
    }

    #dmt-slider::-webkit-slider-thumb:hover {
      background: #fff;
    }

    #dmt-value {
      min-width: 3ch;
      text-align: right;
      color: rgba(255,255,255,0.6);
    }

    #reset-btn {
      background: none;
      border: 1px solid rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.3);
      font-family: 'Courier New', monospace;
      font-size: 0.65rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 0.25rem 0.6rem;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }

    #reset-btn:hover {
      border-color: rgba(255,255,255,0.5);
      color: rgba(255,255,255,0.7);
    }

    /* Bifurcation zone indicator · subtle colour shift on the slider track */
    #dmt-slider.above-threshold {
      background: linear-gradient(
        to right,
        rgba(255,255,255,0.08) 0%,
        rgba(255,255,255,0.08) 42%,
        rgba(200,80,40,0.5) 42%,
        rgba(200,80,40,0.5) 100%
      );
    }
  `
  document.head.appendChild(style)

  const container = document.createElement('div')
  container.id = 'controls'
  container.innerHTML = `
    <label>DMT α</label>
    <input type="range" id="dmt-slider" min="0" max="100" value="0" step="1" />
    <span id="dmt-value">0.00</span>
    <button id="reset-btn">reset</button>
  `
  document.body.appendChild(container)

  const slider   = document.getElementById('dmt-slider')
  const valueEl  = document.getElementById('dmt-value')
  const resetBtn = document.getElementById('reset-btn')

  // Bifurcation occurs around α ≈ 0.45. Mark it on the slider track.
  const BIFURCATION = 0.45

  slider.addEventListener('input', () => {
    const alpha = slider.value / 100
    valueEl.textContent = alpha.toFixed(2)
    slider.classList.toggle('above-threshold', alpha >= BIFURCATION)
    onDMTChange(alpha)
  })

  resetBtn.addEventListener('click', () => {
    slider.value = 0
    valueEl.textContent = '0.00'
    slider.classList.remove('above-threshold')
    onDMTChange(0)
    onReset()
  })

  return {
    getDMT: () => slider.value / 100,
  }
}
