import { 
    gEpicDB, 
    gSetPlayState, 
    gJumpToEpicTime, 
    addEpicTimeChangeCallback, 
    removeEpicTimeChangeCallback } from '././app.js';
import { skyPhotosDB } from "./sky_photos_db.js";
import { openPopupFromThumbnail } from './sky-photos-popup.js';
import { gControlState } from './controlparams.js';
import DragScroller from './drag_scroller.js'
import { getStorageProvider } from './gdrive_provider.js';
import { addSkyPhotosToggleCallback } from './topUI.js';

const SECONDS_IN_DAY = 3600*24;

const skyPhotosScrollGallery = new DragScroller('skyPhotosScrollGallery');
skyPhotosScrollGallery.hide();

let buildingSkyPics = false;

setSkyPhotosScrollGalleryCallbacks();

function createScrollPicDiv(data)
{
    const node = skyPhotosScrollGallery.createItem();//.replace(/=s\d+/, `=s${size}`);
    const img = skyPhotosScrollGallery.getItemImg(node);
    getStorageProvider().loadImageFromField(img, data.image);
    return node;
}

function createPicElements(skyPhotoRecord)
{
    if (!skyPhotoRecord) {
        console.error("Null skyPhotoRecord");
        return;
    }

    skyPhotoRecord.scrollPicDiv = createScrollPicDiv(skyPhotoRecord);
}

function jumpToPicEpicTimeByIndex(index)
{
    if (index == undefined)
        return;
    const picItem = skyPhotosDB.getSkyPhotoAtEpicTimeIndex(index);
    if (!picItem)
    {
        console.error("No sky pic at index ", index);
        return;
    }
    const timeSec = picItem.epicTimeSec;
    gSetPlayState(false);
    gControlState.blockSnapping = true;
    gJumpToEpicTime(timeSec);
}

function setEpicTimeByPicsAlpha(alpha)
{
    const timeSec = skyPhotosDB.getEpicTimeSecByAlpha(alpha);
    if (!timeSec) {
        console.error("Could not resolve Epic Time by alpha ", alpha);
        return;
    }
    gSetPlayState(false);
    gControlState.blockSnapping = true;
    gJumpToEpicTime(timeSec);
}

skyPhotosDB.addNewSkyPhotoCallback(async (record) => {    
    const index = record.epicTimeIndex;
    const picItem = record;

    const timestampTimeSec = picItem.epicTimeSec;
    const timestampDate = new Date(timestampTimeSec * 1000);

    console.debug("Placing new sky photo of time " + timestampDate + " at index " + index);
    createPicElements(picItem);

    const scrollPicDiv = picItem.scrollPicDiv;
    skyPhotosScrollGallery.insertItemAtIndex(scrollPicDiv, 
        skyPhotosScrollGallery.getNumItems() == 0 ? -1 : index); 
});

function setSkyPhotosScrollGalleryCallbacks()
{
    skyPhotosScrollGallery.setSelectItemCb((node, index) => {
        const scrollDivImg = skyPhotosScrollGallery.getItemImg(node);
        scrollDivImg.style.border = `4px solid rgba(255, 255, 255, 1)`;

        if (buildingSkyPics)
            return;
        jumpToPicEpicTimeByIndex(index);
    });

    skyPhotosScrollGallery.setUnselectItemCb((node, index) => {
        const scrollDivImg = skyPhotosScrollGallery.getItemImg(node);
        scrollDivImg.style.border = `0px solid`;
    });

    skyPhotosScrollGallery.setSelectedItemClickCb((node, index) => {
        if (buildingSkyPics)
            return;
        let picImg = skyPhotosScrollGallery.getItemImg(node);
        openPopupFromThumbnail(picImg, picItem);
    });

    skyPhotosScrollGallery.setScrollAlphaCb((alpha) => {
        if (buildingSkyPics)
            return;
        setEpicTimeByPicsAlpha(alpha);
    });

}

async function addSkyPhotos()
{
    console.log("Adding current sky photos to gallery");
    await addCurrentSkyPhotos();
    console.log("Adding sky photos before first one in gallery");
    if (!addSkyPhotosBefore()) 
    {
        console.warn("Adding all sky photos to gallery");
        addAllSkyPhotos();
    }
}

async function addCurrentSkyPhotos()
{
    const dayBeforeLatestEpicTimeSec = gEpicDB.getLatestEpicImageTimeSec() - SECONDS_IN_DAY;
    const dayBeforeLatestEpicDate = new Date(dayBeforeLatestEpicTimeSec * 1000);
    buildingSkyPics = true;
    await skyPhotosDB.fetchSkyPhotosAfterDate(dayBeforeLatestEpicDate);
    buildingSkyPics = false;
}

async function addSkyPhotosBefore(nDocsBefore = 0)
{
    buildingSkyPics = true;
    await skyPhotosDB.fetchMoreSkyPhotosBefore(nDocsBefore);
    buildingSkyPics = false;
}

async function addAllSkyPhotos()
{
    buildingSkyPics = true;
    await skyPhotosDB.fetchAllSkyPhotos();
    buildingSkyPics = false;
}

function updateScrollSkyPhotos(epicTimeSec)
{
    const alpha = skyPhotosDB.getAlphaByEpicTimeSec(epicTimeSec);
    if (alpha < 0 || alpha > 1)
    {
        //console.error("Could not get alpha from EPIC timeSec ", epicTimeSec);
        return;
    }
    skyPhotosScrollGallery.scrollToAlpha(alpha);
}

let epicTimeChangeCallbackId = undefined;

addSkyPhotosToggleCallback((isOn) => {
    if (isOn) {
        skyPhotosScrollGallery.show();
        console.assert(epicTimeChangeCallbackId === undefined);
        if (epicTimeChangeCallbackId === undefined)
            epicTimeChangeCallbackId = addEpicTimeChangeCallback(updateScrollSkyPhotos);
        addSkyPhotos();
    }
    else {
        skyPhotosScrollGallery.hide();
        if (epicTimeChangeCallbackId !== undefined)
            removeEpicTimeChangeCallback(epicTimeChangeCallbackId);
    }
});
