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
  #scrollLeft;
  #defaultDisplayMode;
  #isDragging = false;
  #DRAG_THRESHOLD = 5; // pixels
  #startClientX;
  #startClientY;
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
    this.#scroller.addEventListener('pointerup', this._endPointerInteraction);
    this.#scroller.addEventListener('mousedown', this._onPointerDown);
    this.#scroller.addEventListener('mousemove', this._onPointerMove);
    this.#scroller.addEventListener('mouseup', this._endPointerInteraction);
    this.#scroller.addEventListener('touchstart', this._onPointerDown);
    this.#scroller.addEventListener('touchmove', this._onPointerMove);
    this.#scroller.addEventListener('touchend', this._endPointerInteraction);
    //this.#scroller.addEventListener('pointercancel', this._endPointerInteraction);
    //this.#scroller.addEventListener('lostpointercapture', this._endPointerInteraction);
    // Window-level safety net
    window.addEventListener('blur', this._endPointerInteraction);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._endPointerInteraction();
      }
    });

    this.#scroller.addEventListener('scroll',this._onScroll);
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
        this._setSelectedIndex(this.#selectedItemIndex + 1);
    }

    node.onclick = (e) => {
      //console.log(e.type);
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
    if (this.#isDown)
      return;

    //console.log("alpha: ", alpha);
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
      this._setSelectedIndex(undefined);
      this.#scroller.scrollTo({
        ...(this.#isHorizontal ? { left: target } : { top: target }),
        behavior: 'auto'
      });

      this._requestMoreIfNeeded(target);        
    }
  }
  
  
  _getStartSpacerNumItemsExposure(targetScroll)
  {
    const startSpacerSize = this.#isHorizontal ? this.#startSpacer.clientWidth : this.#startSpacer.clientHeight;
    if (targetScroll - startSpacerSize < startSpacerSize) {
      const firstItemSize = this._getItemSize(this.#itemsGroup.children[2]);
      return Math.ceil((2 * startSpacerSize - startSpacerSize) / firstItemSize);
    }
    else
      return 0;
  }

  _getEndSpacerNumItemsExposure(targetScroll)
  {
    const limits = this._getScrollLimits();
    if (!limits) 
      return false;
    const endSpacerSize = this.#isHorizontal ? this.#endSpacer.clientWidth : this.#endSpacer.clientHeight;
    if (targetScroll + endSpacerSize > limits.max) {
      const lastItemSize = this._getItemSize(this.#itemsGroup.children[this.#itemsGroup.children.length - 2]);
      return Math.ceil((2 * endSpacerSize - endSpacerSize) / lastItemSize);
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

    if (index == this.#selectedItemIndex)
    {
      if (this.#onSelectedItemClickCb)
        this.#onSelectedItemClickCb(this.#itemsGroup.children[index + 2], index); // skip start spacer+template
      return;
    }

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

    this.#scroller.scrollTo({
      left: this.#isHorizontal ? target : this.#scroller.scrollLeft,
      top:  this.#isHorizontal ? this.#scroller.scrollTop  : target,
      behavior: 'smooth'
    });
    this._setSelectedIndex(index);
    this._requestMoreIfNeeded(target);        
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
    //console.log(e.type);
    this.#isDown = true;
    this.#scroller.style.cursor = 'grabbing';
    this.#isDragging = false;
    if (e.clientX != undefined)
      this.#startClientX = e.clientX;
    if (e.clientY != undefined)
      this.#startClientY = e.clientY;
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
    //console.log(e.type);
    this.#isDown = false;
    this.#scroller.style.cursor = 'grab';

    if (this.#isDragging) {
      this.#scroller.releasePointerCapture(e.pointerId);
      // Prevent the upcoming click globally
      this._suppressNextClick();
      this._onScrollEnd();
    }

    this.#isDragging = false;
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
    //console.log(e.type);
    if (!this.#isDown) return;

    const dx = Math.abs(e.clientX - this.#startClientX);
    const dy = Math.abs(e.clientY - this.#startClientY);

    const moveDelta = this.#isHorizontal ? dx : dy;
    if (moveDelta > this.#DRAG_THRESHOLD) {
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
    //console.log(e.type);

  }

  _onScrollEnd()
  {
    this.#isDragging = false;
    this._snapToNearest();
  }

  _snapToNearest() {
    const children = this.#itemsGroup.children;
    if (children.length <= 2) // means empty with spacers
      return;

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
        console.log("Unselected item index: ", this.#selectedItemIndex);
        if (this.#onUnselectItemCb)
          this.#onUnselectItemCb(this.#itemsGroup.children[this.#selectedItemIndex + 2], this.#selectedItemIndex); // skip start spacer+template
      }

      this.#selectedItemIndex = index;
      
      if (index === undefined)
      {
        console.debug("No selected item");
        return;
      }

      console.log("Selected item index: ", index);

      if (this.#onSelectItemCb)
        this.#onSelectItemCb(this.#itemsGroup.children[index + 2], index); // skip start spacer+template
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
    if (this.#isDragging) return;

    const index = Array.prototype.indexOf.call(
      this.#itemsGroup.children,
      node
    );

    this.scrollToIndex(index - 2); // skip start spacer+template
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
  _requestMoreIfNeeded(targetScroll) {
    this._requestMoreIfNeededLeft(targetScroll);
    this._requestMoreIfNeededRight(targetScroll);    
  }

  _requestMoreIfNeededLeft(targetScroll) {
    if (this.#requestLeftPromise || this.#completedLeft)
      return;

    const numItemsNeeded = this._getStartSpacerNumItemsExposure(targetScroll);
    if (numItemsNeeded > 0)
    {
      console.log("Need " + numItemsNeeded + " more items to the left");
      if (this.#onRequestMoreLeftCb)
        this.#requestLeftPromise = this.#onRequestMoreLeftCb(numItemsNeeded);
      else
        this.#requestLeftPromise = new Promise(resolve => {
            // by default, simulate a process that takes 1s
            setTimeout(() => {
                resolve(this.notifyRequestMoreLeftComplete());
              }, 1000);
          });
    }
  }

  _requestMoreIfNeededRight(targetScroll) {
    if (this.#requestRightPromise || this.#completedRight)
      return;
    const numItemsNeeded = this._getEndSpacerNumItemsExposure(targetScroll);
    if (numItemsNeeded > 0)
    {
      console.log("Need " + numItemsNeeded + " more items to the right");
      if (this.#onRequestMoreRightCb)
        this.#requestRightPromise = this.#onRequestMoreRightCb(numItemsNeeded);
      else
        this.#requestRightPromise = new Promise(resolve => {
            // by default, simulate a process that takes 1s
            setTimeout(() => {
                resolve(this.notifyRequestMoreRightComplete());
              }, 1000);
          });
    }
  }
}
