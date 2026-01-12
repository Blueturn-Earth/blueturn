export default class DragScroller
{
  #scroller;
  #itemsGroup;
  #itemTemplate;
  #itemStyleDisplay;
  #startSpacer;
  #endSpacer;
  #numItems = 0;
  #isDown = false;
  #startX;
  #defaultDisplayMode;
  #isDragging = false;
  #isDecelerating = false;
  #isSnapping = false;
  #isProgrammaticScroll = false;
  #DRAG_THRESHOLD = 5; // pixels
  #lastMoveDelta = 0;
  #MOVE_THRESHOLD = 3; // pixels
  #startClientX;
  #startClientY;
  #lastClientX;
  #lastClientY;
  #isHorizontal;
  #selectedItemIndex;
  #onSelectItemCb;
  #onUnselectItemCb;
  #onSelectedItemClickCb;
  #onScrollAlphaCb;

  constructor(idName) {
    this.#scroller = document.getElementById(idName);
    this.#defaultDisplayMode = this.#scroller.style.display;
    this.#itemsGroup = this.#scroller.children[0];
    this.#itemTemplate = this.#itemsGroup.children[0];
    this.#itemStyleDisplay = this.#itemTemplate.style.display;
    this.#itemTemplate.style.display = 'none'; // hide template

    this.#startSpacer = document.createElement('div');
    this.#endSpacer   = document.createElement('div');
    this.#startSpacer.className = 'scroll-spacer scroll-start-spacer';
    this.#endSpacer.className   = 'scroll-spacer scroll-end-spacer';
    this.#itemsGroup.prepend(this.#startSpacer);
    this.#itemsGroup.append(this.#endSpacer);

    this._updateOrientation();
    window.addEventListener('resize', () => {
      this._updateOrientation();
      this._updateSpacers();
    });

    this.#scroller.addEventListener('pointerdown', this._onPointerDown);
    this.#scroller.addEventListener('pointermove', this._onPointerMove);
    this.#scroller.addEventListener('pointerup', (e) => {
      this._endPointerInteraction(e);
    });
    this.#scroller.addEventListener('mousedown', this._onPointerDown);
    this.#scroller.addEventListener('mousemove', this._onPointerMove);
    this.#scroller.addEventListener('mouseup', (e) => {
      this._endPointerInteraction(e);
    });
    this.#scroller.addEventListener('touchstart', this._onPointerDown);
    this.#scroller.addEventListener('touchmove', this._onPointerMove);
    this.#scroller.addEventListener('touchend', (e) => {
      this._endPointerInteraction(e);
    });
    //this.#scroller.addEventListener('pointercancel', this._endPointerInteraction);
    //this.#scroller.addEventListener('lostpointercapture', this._endPointerInteraction);
    // Window-level safety net
    window.addEventListener('blur', (e) => {
      this._endPointerInteraction(e);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._endPointerInteraction();
      }
    });

    this.#scroller.addEventListener('scroll', this._onScroll);
    this.#scroller.addEventListener('scrollend', async (e) => {
      await this._onScrollEnd(e);
    });
  }

  setSelectItemCb(cb) {
    this.#onSelectItemCb = cb;
  }

  setUnselectItemCb(cb) {
    this.#onUnselectItemCb = cb;
  }

  setSelectedItemClickCb(cb) {
    this.#onSelectedItemClickCb = cb;
  }

  setScrollAlphaCb(cb) {
    this.#onScrollAlphaCb = cb;
  }

  show() {
    this.#scroller.style.display = this.#defaultDisplayMode;
    const currentScrollPos = this.#isHorizontal ? this.#scroller.scrollLeft : this.#scroller.scrollTop;
    this._requestMoreIfNeeded(currentScrollPos);
  }
  
  hide() {
    this.#scroller.style.display = 'none';
  }
  
  imgErrorCount = 0;

  createItem() {
    const node = this.#itemTemplate.cloneNode(true);
    node.style.display = this.#itemStyleDisplay;

    return node;
  }
  
  getItemImg(node) {
    return node.querySelector('img');
  }

  appendItem(node)
  {
    insertItemAtIndex(node, -1);
  }

  insertItemAtIndex(node, index)
  {
    if (this.#itemsGroup.contains(node)) {
      console.warn("Node already in items group!");
      return;
    }

    node.id = `scroll-item-${this.#numItems}`;
    this.#itemsGroup.insertBefore(node, index < 0 ? this.#endSpacer : this.#itemsGroup.children[index + 2]);
    this._updateSpacers();
    
    if(this.#selectedItemIndex !== undefined &&
      this.#selectedItemIndex >= index) {
        this.scrollToIndex(this.#selectedItemIndex + 1, false);
    }

    node.onclick = (e) => {
      //console.debug(e.type);
      this._onItemClick(node);
    };

    this.#numItems++;
  }

  clearItems()
  {
    // remove only non-spacer children, keep the first one
    for (let i = 0; i < this.#numItems; i++)
    {
      this.#itemsGroup.removeChild(this.#itemsGroup.children[2]);
    }
    this._updateSpacers();
    this.#numItems = 0;
    this.imgErrorCount = 0;
  }

  getNumItems()
  {
    return this.#numItems;
  }

  scrollToAlpha(alpha) {
    if (this.#isDown || this.#isSnapping || this.#isDragging || this.#isDecelerating)
      return;

    const limits = this._getScrollLimits();
    if (!limits) return;

    alpha = Math.max(0, Math.min(1, alpha));

    const target =
      limits.min + alpha * (limits.max - limits.min);

    const needScroll = 
      this.#isHorizontal ? 
        Math.abs(this.#scroller.scrollLeft - target) > 1 : 
        Math.abs(this.#scroller.scrollTop - target) > 1;
    if (needScroll) {
      console.debug("Scroll to alpha: ", alpha);
      this.#isProgrammaticScroll = true;
      this.#scroller.scrollTo({
        ...(this.#isHorizontal ? { left: target } : { top: target }),
        behavior: 'instant'
      });
    }
  }
  
  _getStartSpacerNumItemsExposure(scrollPos)
  {
    const startSpacerSize = this.#isHorizontal ? this.#startSpacer.clientWidth : this.#startSpacer.clientHeight;
    if (scrollPos < startSpacerSize) {
      const firstItemSize = this._getItemSize(this.#itemsGroup.children[2]);
      return Math.ceil(startSpacerSize / firstItemSize);
    }
    else
      return 0;
  }

  _getEndSpacerNumItemsExposure(scrollPos)
  {
    const limits = this._getScrollLimits();
    if (!limits) 
      return false;
    const endSpacerSize = this.#isHorizontal ? this.#endSpacer.clientWidth : this.#endSpacer.clientHeight;
    if (scrollPos + endSpacerSize > limits.max) {
      const lastItemSize = this._getItemSize(this.#itemsGroup.children[this.#itemsGroup.children.length - 2]);
      return Math.ceil(endSpacerSize / lastItemSize);
    }
    else
      return 0;
  }
  
  getScrolledAlpha() {
    const limits = this._getScrollLimits();
    if (!limits) return 0;

    const pos = this.#isHorizontal ? this.#scroller.scrollLeft : this.#scroller.scrollTop;

    return (pos - limits.min) / (limits.max - limits.min);
  }

  scrollToIndex(index, smooth = true) {
    if (this.#isDown) 
      return;

    const children = this.#itemsGroup.children;
    if (!children.length) return;

    // skip start spacer+template
    const childIndex = index + 2; 
    // forbid spacers
    if (childIndex < 2 || childIndex >= children.length - 1)
    {
      console.warn("scrollToIndex: index out of bounds: ", index);
      return;
    }

    const item = children[childIndex];

    const itemCenter = this._getItemCenter(item);
    const viewportSize = this.#isHorizontal
      ? this.#scroller.clientWidth
      : this.#scroller.clientHeight;

    const target = itemCenter - viewportSize / 2;

    this.#isSnapping = true;
    this.#scroller.scrollTo({
      left: this.#isHorizontal ? target : this.#scroller.scrollLeft,
      top:  this.#isHorizontal ? this.#scroller.scrollTop  : target,
      behavior: smooth ? 'smooth' : 'instant'
    });
    this._setSelectedIndex(index);
  }

  getSelectedItemIndex() {
    return this.#selectedItemIndex;
  }

  _updateOrientation() {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    this.#isHorizontal = isPortrait;

    // Optional: CSS hook
    this.#scroller.classList.toggle('horizontal', isPortrait);
    this.#scroller.classList.toggle('vertical', !isPortrait);
  }

  _onPointerDown = (e) =>
  {
    //console.debug(e.type);
    this.#isDown = true;
    this.#scroller.style.cursor = 'grabbing';
    this.#isDragging = false;
    if (e.clientX != undefined)
      this.#startClientX = this.#lastClientX = e.clientX;
    if (e.clientY != undefined)
      this.#startClientY = this.#lastClientY = e.clientY;
    if (e.pageX != undefined && e.pageY != undefined)
      this.#startX = this.#isHorizontal
        ? e.pageX - this.#scroller.offsetLeft
        : e.pageY - this.#scroller.offsetTop;
    this.scrollStart = this.#isHorizontal
      ? this.#scroller.scrollLeft
      : this.#scroller.scrollTop;
  }

  _endPointerInteraction = (e) =>
  {
    console.debug("End of pointer interaction: " + e?.type);
    this.#isDown = false;
    this.#scroller.style.cursor = 'grab';

    if (this.#isDragging) {
      this.#scroller.releasePointerCapture(e.pointerId);
      // Prevent the upcoming click globally
      this._suppressNextClick();
      this.#isDragging = false;
      if (this.#lastMoveDelta < this.#MOVE_THRESHOLD) {
        console.debug("Snapping to nearest...");
        this._snapToNearest();
      }
      else {
        console.debug("Decelerating...");
        this.#isDecelerating = true;
      }
    }
    this.#lastMoveDelta = 0;
  }

  _suppressNextClick() {
    const handler = e => {
      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener('click', handler, true);
    };

    // Capture ONCE, then remove
    document.addEventListener('click', handler, true);
  }

  _onPointerMove = (e) =>
  {
    //console.debug(e.type);
    if (!this.#isDown) return;

    const dx = Math.abs(e.clientX - this.#lastClientX);
    const dy = Math.abs(e.clientY - this.#lastClientY);
    this.#lastMoveDelta = this.#isHorizontal ? dx : dy;
    this.#lastClientX = e.clientX;
    this.#lastClientY = e.clientY;

    const dsx = Math.abs(e.clientX - this.#startClientX);
    const dsy = Math.abs(e.clientY - this.#startClientY);

    const moveFromStart = this.#isHorizontal ? dsx : dsy;
    if (moveFromStart > this.#DRAG_THRESHOLD) {
      this.#isDragging = true;
    }
    else {
      return; // ⬅️ do NOT prevent default yet
    }

    // Now it's a drag
    if (e && e.pointerId)
      this.#scroller.setPointerCapture(e.pointerId);
    e.preventDefault();

    const current = this.#isHorizontal
      ? e.pageX - this.#scroller.offsetLeft
      : e.pageY - this.#scroller.offsetTop;

    const delta = current - this.#startX;

    const limits = this._getScrollLimits();
    if (this.#isHorizontal) {
      this.#scroller.scrollLeft = this.scrollStart - delta;
      if (limits) {
        this.#scroller.scrollLeft = Math.max(
          limits.min,
          Math.min(limits.max, this.#scroller.scrollLeft)
        );
      }
    } else {
      this.#scroller.scrollTop = this.scrollStart - delta;
      if (limits) {
        this.#scroller.scrollTop = Math.max(
          limits.min,
          Math.min(limits.max, this.#scroller.scrollTop)
        );
      }
    }

    if(this.#onScrollAlphaCb) {
      const alpha = this.getScrolledAlpha();
      this.#onScrollAlphaCb(alpha);
    }
  }

  _onScroll = (e) =>
  {
    //console.debug(e.type);
    this._requestMoreIfNeeded(target);
  }

  _onScrollEnd = async (e) =>
  {
    console.debug("Scroll end: " + e?.type);
    if (this.#isDown || this.#isProgrammaticScroll) {
      this.#isProgrammaticScroll = false;
      return;
    }

    if (this.#isDecelerating) {      
      console.debug("End of decelerating");
      this.#isDecelerating = false;
      this._snapToNearest();
    }
    else if (this.#isSnapping) {
      console.debug("End of snapping");
      if(this.#onSelectItemCb && this.#selectedItemIndex !== undefined) {
        await this.#onSelectItemCb(this.#itemsGroup.children[this.#selectedItemIndex + 2], this.#selectedItemIndex); // skip start spacer+template
      }
      this.#isSnapping = false;
    }
  };

  _snapToNearest() {
    const children = this.#itemsGroup.children;
    if (children.length <= 3) { // means empty with spacers and template
      console.debug("Cannot snap to nearest: empty");
      return;
    }

    console.debug("Snap to nearest");

    const scrollPos = this.#isHorizontal
      ? this.#scroller.scrollLeft
      : this.#scroller.scrollTop;

    const viewportSize = this.#isHorizontal
      ? this.#scroller.clientWidth
      : this.#scroller.clientHeight;

    const viewportCenter = scrollPos + viewportSize / 2;

    let closest = null;
    let minDist = Infinity;

    let closestChildIndex;
    let childIndex = 0;
    for (const item of children) {
      // skip spacers
      if (childIndex > 1 && childIndex < children.length - 1) {
        const center = this._getItemCenter(item);
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
        this._getItemCenter(closest) - viewportSize / 2;

      this.#isSnapping = true;
      this.#scroller.scrollTo({
        ...(this.#isHorizontal ? { left: target } : { top: target }),
        behavior: 'smooth'
      });
      this._setSelectedIndex(closestChildIndex - 2); // skip start spacer+template
  }

  _setSelectedIndex(index)
  {
    if (index != this.#selectedItemIndex)
    {
      if (this.#selectedItemIndex !== undefined)
      {
        console.debug("Unselected item index: ", this.#selectedItemIndex);
        if (this.#onUnselectItemCb)
          this.#onUnselectItemCb(this.#itemsGroup.children[this.#selectedItemIndex + 2], this.#selectedItemIndex); // skip start spacer+template
      }

      this.#selectedItemIndex = index;
      
      if (index === undefined)
      {
        console.debug("No selected item");
        return;
      }

      console.debug("Selected item index: ", index);
    }
}

  _getItemSize(item) {
    const rect = item.getBoundingClientRect();
    return this.#isHorizontal ? rect.width : rect.height;
}

  _getItemCenter(item) {
    const rect = item.getBoundingClientRect();
    const scrollerRect = this.#scroller.getBoundingClientRect();

    return this.#isHorizontal
      ? (rect.left - scrollerRect.left) +
          rect.width / 2 +
          this.#scroller.scrollLeft
      : (rect.top - scrollerRect.top) +
          rect.height / 2 +
          this.#scroller.scrollTop;
  }

  _getScrollLimits() {
    const children = this.#itemsGroup.children;
    if (!children.length) return null;

    const viewportSize =
      this.#isHorizontal ? this.#scroller.clientWidth : this.#scroller.clientHeight;

    // skip spacers
    const firstCenter = this._getItemCenter(children[2]);
    const lastCenter  = this._getItemCenter(children[children.length - 2]);

    return {
      min: firstCenter - viewportSize / 2,
      max: lastCenter  - viewportSize / 2
    };
  }  

  _updateSpacers() {
    const size = !this.#isHorizontal
      ? this.#scroller.clientHeight
      : this.#scroller.clientWidth;

    const half = size / 2;

    if (!this.#isHorizontal) {
      this.#startSpacer.style.height = `${half}px`;
      this.#endSpacer.style.height   = `${half}px`;

      this.#startSpacer.style.width = '100%';
      this.#endSpacer.style.width   = '100%';
    } else {
      this.#startSpacer.style.width = `${half}px`;
      this.#endSpacer.style.width   = `${half}px`;

      this.#startSpacer.style.height = '100%';
      this.#endSpacer.style.height   = '100%';
    }
  }

  _onItemClick = (node) => {
    if (this.#isDragging || this.#isSnapping) return;

    const childIndex = Array.prototype.indexOf.call(
      this.#itemsGroup.children,
      node
    );

    const itemIndex = childIndex - 2; // skip start spacer+template

    if (itemIndex == this.#selectedItemIndex)
    {
      if (this.#onSelectedItemClickCb)
        this.#onSelectedItemClickCb(this.#itemsGroup.children[childIndex], itemIndex);
      return;
    }

    this.scrollToIndex(itemIndex);
  };

  // Pagination mechanism
  #onRequestMoreLeftCb;
  #onRequestMoreRightCb;
  #requestLeftPromise;
  #requestRightPromise;
  #completedLeft = false;
  #completedRight = false;

  setOnRequestMoreLeftCb(cb) {
    this.#onRequestMoreLeftCb = cb;
  }
  setOnRequestMoreRightCb(cb) {
    this.#onRequestMoreRightCb = cb;
  }
  notifyRequestMoreLeftComplete(fullyComplete) {
    this.#requestLeftPromise = null;
    this.#completedLeft = fullyComplete;
    if (this.#completedLeft)
      console.log("No more items available to the left");
  }
  notifyRequestMoreRightComplete(fullyComplete) {
    this.#requestRightPromise = null;
    this.#completedRight = fullyComplete;
    if (this.#completedRight)
      console.log("No more items available to the right");
  }
  _requestMoreIfNeeded(scrollPos) {
    if (scrollPos === undefined)
      scrollPos = this.#isHorizontal ? this.#scroller.scrollLeft : this.#scroller.scrollTop;

    this._requestMoreIfNeededLeft(scrollPos);
    this._requestMoreIfNeededRight(scrollPos);    
  }

  _requestMoreIfNeededLeft(scrollPos) {
    if (this.#requestLeftPromise || this.#completedLeft)
      return;

    const numItemsNeeded = this._getStartSpacerNumItemsExposure(scrollPos);
    if (numItemsNeeded > 0)
    {
      if (this.#onRequestMoreLeftCb)
        this.#requestLeftPromise = this.#onRequestMoreLeftCb(numItemsNeeded);
      else
        this.notifyRequestMoreLeftComplete(false);
    }
  }

  _requestMoreIfNeededRight(scrollPos) {
    if (this.#requestRightPromise || this.#completedRight)
      return;
    const numItemsNeeded = this._getEndSpacerNumItemsExposure(scrollPos);
    if (numItemsNeeded > 0)
    {
      if (this.#onRequestMoreRightCb)
        this.#requestRightPromise = this.#onRequestMoreRightCb(numItemsNeeded);
      else
        this.notifyRequestMoreLeftComplete(false);
    }
  }
}
