import { 
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

const skyPhotosScrollGallery = new DragScroller('skyPhotosScrollGallery');
skyPhotosScrollGallery.hide();

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

    console.debug("Placing new sky photo of time " + timestampDate + " in Scroller at index " + index);
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
        jumpToPicEpicTimeByIndex(index);
    });

    skyPhotosScrollGallery.setUnselectItemCb((node, index) => {
        const scrollDivImg = skyPhotosScrollGallery.getItemImg(node);
        scrollDivImg.style.border = `0px solid`;
    });

    skyPhotosScrollGallery.setSelectedItemClickCb((node, index) => {
        const picItem = skyPhotosDB.getSkyPhotoAtEpicTimeIndex(index);
        const picImg = skyPhotosScrollGallery.getItemImg(node);
        openPopupFromThumbnail(picImg, picItem);
    });

    skyPhotosScrollGallery.setScrollAlphaCb((alpha) => {
        setEpicTimeByPicsAlpha(alpha);
    });

    skyPhotosScrollGallery.setOnRequestMoreLeftCb(async (numRecords) => {
        const firstSkyPhoto = skyPhotosDB.getSkyPhotoAtEpicTimeIndex(0);
        const firstEpicDate = new Date(firstSkyPhoto.epicTimeSec * 1000);
        await skyPhotosDB.fetchBeforeDate(firstEpicDate, numRecords);
        const fullyComplete = skyPhotosDB.hasReachedMinTime();
        skyPhotosScrollGallery.notifyRequestMoreLeftComplete(fullyComplete);
    });

    skyPhotosScrollGallery.setOnRequestMoreRightCb(async (numRecords) => {
        const numSkyPhotos = skyPhotosDB.getNumSkyPhotos();
        const lastSkyPhoto = skyPhotosDB.getSkyPhotoAtEpicTimeIndex(numSkyPhotos - 1);
        const lastEpicDate = new Date(lastSkyPhoto.epicTimeSec * 1000);
        await skyPhotosDB.fetchAfterDate(lastEpicDate, numRecords);
        const fullyComplete = skyPhotosDB.hasReachedMaxTime();
        skyPhotosScrollGallery.notifyRequestMoreRightComplete(fullyComplete);
    });
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
    }
    else {
        skyPhotosScrollGallery.hide();
        if (epicTimeChangeCallbackId !== undefined) {
            removeEpicTimeChangeCallback(epicTimeChangeCallbackId);
            epicTimeChangeCallbackId = undefined;
        }
    }
});
