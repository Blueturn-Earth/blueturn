export default class DragScroller
{
  scroller;
  itemsGroup;
  numItems = 0;
  isDown = false;
  startX;
  scrollLeft;
  defaultDisplayMode;
  isDragging = false;
  DRAG_THRESHOLD = 5; // pixels
  startClientX;
  startClientY;
  isHorizontal;
  selectedItemIndex;
  onSelectItemCb;
  onSelectedItemClickCb;

  constructor(idName) {
    this.scroller = document.getElementById(idName);
    this.defaultDisplayMode = this.scroller.style.display;
    this.itemsGroup = this.scroller.children[0];

    this.startSpacer = document.createElement('div');
    this.endSpacer   = document.createElement('div');
    this.startSpacer.className = 'scroll-spacer scroll-start-spacer';
    this.endSpacer.className   = 'scroll-spacer scroll-end-spacer';
    this.itemsGroup.prepend(this.startSpacer);
    this.itemsGroup.append(this.endSpacer);

    this.#updateOrientation();
    window.addEventListener('resize', () => {
      this.#updateOrientation();
      this.#updateSpacers();
    });

    this.scroller.addEventListener('pointerdown', this.#onPointerDown);
    this.scroller.addEventListener('pointermove', this.#onPointerMove);
    this.scroller.addEventListener('pointerup', this.#endPointerInteraction);
    this.scroller.addEventListener('mousedown', this.#onPointerDown);
    this.scroller.addEventListener('mousemove', this.#onPointerMove);
    this.scroller.addEventListener('mouseup', this.#endPointerInteraction);
    this.scroller.addEventListener('touchstart', this.#onPointerDown);
    this.scroller.addEventListener('touchmove', this.#onPointerMove);
    this.scroller.addEventListener('touchend', this.#endPointerInteraction);
    //this.scroller.addEventListener('pointercancel', this.#endPointerInteraction);
    //this.scroller.addEventListener('lostpointercapture', this.#endPointerInteraction);
    // Window-level safety net
    window.addEventListener('blur', this.#endPointerInteraction);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.#endPointerInteraction();
      }
    });

    this.scroller.addEventListener('scroll',this.#onScroll);
  }

  setSelectItemCb(cb) {
    this.onSelectItemCb = cb;
  }

  setSelectedItemClickCb(cb) {
    this.onSelectedItemClickCb = cb;
  }

  show() {
    this.scroller.style.display = this.defaultDisplayMode;
  }
  
  hide() {
    this.scroller.style.display = 'none';
  }
  
  appendItem(node)
  {
    // Remove sample node
    if (this.numItems == 0)
    {
      this.itemsGroup.removeChild(this.itemsGroup.children[1]);
    }

    if (this.itemsGroup.contains(node)) {
      console.warn("Node already in items group!");
      return;
    }

    this.itemsGroup.insertBefore(node, this.endSpacer);
    this.#updateSpacers();
    this.#snapToNearest();

    node.addEventListener('click', (e) => {
      //console.log(e.type);
      this.#onItemClick(node);
    });

    this.numItems++;
  }

  scrollToAlpha(alpha) {
    if (this.isDown)
      return;

    //console.log("alpha: ", alpha);
    const limits = this.#getScrollLimits();
    if (!limits) return;

    alpha = Math.max(0, Math.min(1, alpha));

    const target =
      limits.min + alpha * (limits.max - limits.min);

    const needScroll = 
      this.isHorizontal ? 
        Math.abs(this.scroller.scrollLeft - target) > 1 : 
        Math.abs(this.scroller.scrollTop - target) > 1;
    if (needScroll) {
      this.#setSelectedIndex(undefined);
      this.scroller.scrollTo({
        ...(this.isHorizontal ? { left: target } : { top: target }),
        behavior: 'auto'
      });
    }
  }
  
  getScrolledAlpha() {
    const limits = this.#getScrollLimits();
    if (!limits) return 0;

    const pos = this.isHorizontal ? this.scroller.scrollLeft : this.scroller.scrollTop;

    return (pos - limits.min) / (limits.max - limits.min);
  }

  scrollToIndex(index, smooth = true) {
    if (this.isDown) 
      return;

    if (index == this.selectedItemIndex)
    {
      if (this.onSelectedItemClickCb)
        this.onSelectedItemClickCb(this.itemsGroup.children[index + 1], index); // skip start spacer
      return;
    }

    const children = this.itemsGroup.children;
    if (!children.length) return;

    const childIindex = Math.max(0, Math.min(children.length - 2, index + 1)); // skip spacers
    const item = children[childIindex];

    const itemCenter = this.#getItemCenter(item);
    const viewportSize = this.isHorizontal
      ? this.scroller.clientWidth
      : this.scroller.clientHeight;

    const target = itemCenter - viewportSize / 2;

    this.scroller.scrollTo({
      left: this.isHorizontal ? target : this.scroller.scrollLeft,
      top:  this.isHorizontal ? this.scroller.scrollTop  : target,
      behavior: 'smooth'
    });
    this.#setSelectedIndex(index);
  }

  getSelectedItemIndex() {
    return this.selectedItemIndex;
  }

  #updateOrientation() {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    this.isHorizontal = isPortrait;

    // Optional: CSS hook
    this.scroller.classList.toggle('horizontal', isPortrait);
    this.scroller.classList.toggle('vertical', !isPortrait);
  }

  #onPointerDown = (e) =>
  {
    //console.log(e.type);
    this.isDown = true;
    this.scroller.style.cursor = 'grabbing';
    this.isDragging = false;
    if (e.clientX != undefined)
      this.startClientX = e.clientX;
    if (e.clientY != undefined)
      this.startClientY = e.clientY;
    if (e.pageX != undefined && e.pageY != undefined)
      this.startX = this.isHorizontal
        ? e.pageX - this.scroller.offsetLeft
        : e.pageY - this.scroller.offsetTop;
    this.scrollStart = this.isHorizontal
      ? this.scroller.scrollLeft
      : this.scroller.scrollTop;
  }

  #endPointerInteraction = (e) =>
  {
    //console.log(e.type);
    this.isDown = false;
    this.scroller.style.cursor = 'grab';

    if (this.isDragging) {
      this.scroller.releasePointerCapture(e.pointerId);
      // Prevent the upcoming click globally
      this.#suppressNextClick();
      this.#onScrollEnd();
    }

    this.isDragging = false;
  }

  #suppressNextClick() {
    const handler = e => {
      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener('click', handler, true);
    };

    // Capture ONCE, then remove
    document.addEventListener('click', handler, true);
  }

  #onPointerMove = (e) =>
  {
    //console.log(e.type);
    if (!this.isDown) return;

    const dx = Math.abs(e.clientX - this.startClientX);
    const dy = Math.abs(e.clientY - this.startClientY);

    const moveDelta = this.isHorizontal ? dx : dy;
    if (moveDelta > this.DRAG_THRESHOLD) {
      this.isDragging = true;
    }
    else {
      return; // ⬅️ do NOT prevent default yet
    }

    // Now it's a drag
    if (e && e.pointerId)
      this.scroller.setPointerCapture(e.pointerId);
    e.preventDefault();

    const current = this.isHorizontal
      ? e.pageX - this.scroller.offsetLeft
      : e.pageY - this.scroller.offsetTop;

    const delta = current - this.startX;

    const limits = this.#getScrollLimits();
    if (this.isHorizontal) {
      this.scroller.scrollLeft = this.scrollStart - delta;
      if (limits) {
        this.scroller.scrollLeft = Math.max(
          limits.min,
          Math.min(limits.max, this.scroller.scrollLeft)
        );
      }
    } else {
      this.scroller.scrollTop = this.scrollStart - delta;
      if (limits) {
        this.scroller.scrollTop = Math.max(
          limits.min,
          Math.min(limits.max, this.scroller.scrollTop)
        );
      }
    }

  }

  #onScroll = (e) =>
  {
    //console.log(e.type);

  }

  #onScrollEnd()
  {
    this.isDragging = false;
    this.#snapToNearest();
  }

  #snapToNearest() {
    const children = this.itemsGroup.children;
    if (children.length <= 2) // means empty with spacers
      return;

    const scrollPos = this.isHorizontal
      ? this.scroller.scrollLeft
      : this.scroller.scrollTop;

    const viewportSize = this.isHorizontal
      ? this.scroller.clientWidth
      : this.scroller.clientHeight;

    const viewportCenter = scrollPos + viewportSize / 2;

    let closest = null;
    let minDist = Infinity;

    let closestChildIndex;
    let childIndex = 0;
    for (const item of children) {
      // skip spacers
      if (childIndex > 0 && childIndex < children.length - 1) {
        const center = this.#getItemCenter(item);
        const dist = Math.abs(center - viewportCenter);

        if (dist < minDist) {
          minDist = dist;
          closest = item;
          closestChildIndex = childIndex;
        }
      }
      childIndex++;
    }

    if (!closest) return;

    const target =
      this.#getItemCenter(closest) - viewportSize / 2;

    this.scroller.scrollTo({
      ...(this.isHorizontal ? { left: target } : { top: target }),
      behavior: 'smooth'
    });
    this.#setSelectedIndex(closestChildIndex - 1); // skip start spacer
  }

  #setSelectedIndex(index, withClickCb)
  {
    if (index != this.selectedItemIndex)
    {
      this.selectedItemIndex = index;
      
      if (this.onSelectItemCb)
        this.onSelectItemCb(this.itemsGroup.children[index + 1], index); // skip start spacer
    }
}

  #getItemCenter(item) {
    const rect = item.getBoundingClientRect();
    const scrollerRect = this.scroller.getBoundingClientRect();

    return this.isHorizontal
      ? (rect.left - scrollerRect.left) +
          rect.width / 2 +
          this.scroller.scrollLeft
      : (rect.top - scrollerRect.top) +
          rect.height / 2 +
          this.scroller.scrollTop;
  }

  #getScrollLimits() {
    const children = this.itemsGroup.children;
    if (!children.length) return null;

    const viewportSize =
      this.isHorizontal ? this.scroller.clientWidth : this.scroller.clientHeight;

    // skip spacers
    const firstCenter = this.#getItemCenter(children[1]);
    const lastCenter  = this.#getItemCenter(children[children.length - 2]);

    return {
      min: firstCenter - viewportSize / 2,
      max: lastCenter  - viewportSize / 2
    };
  }  

  #updateSpacers() {
    const size = !this.isHorizontal
      ? this.scroller.clientHeight
      : this.scroller.clientWidth;

    const half = size / 2;

    if (!this.isHorizontal) {
      this.startSpacer.style.height = `${half}px`;
      this.endSpacer.style.height   = `${half}px`;

      this.startSpacer.style.width = '100%';
      this.endSpacer.style.width   = '100%';
    } else {
      this.startSpacer.style.width = `${half}px`;
      this.endSpacer.style.width   = `${half}px`;

      this.startSpacer.style.height = '100%';
      this.endSpacer.style.height   = '100%';
    }
  }

  #onItemClick = (node) => {
    if (this.isDragging) return;

    const index = Array.prototype.indexOf.call(
      this.itemsGroup.children,
      node
    );

    this.scrollToIndex(index - 1); // skip start spacer
  };
}
