import sys
import cv2 as cv
import operator
import numpy as np
import math
import json

use_mask = False
img = None
templ = None
match_method = 3
IMG_PADDING_TOP = 150

def exceedsBlackRatio(img, ratio):
    return cv.countNonZero(cv.cvtColor(img, cv.COLOR_BGR2GRAY)) < (1.0-ratio)*img.shape[0]*img.shape[1]

def main(argv):
    if (len(argv) < 1):
        print('Not enough parameters')
        print('Usage:\nocv.py <data file path>')
        return -1

    with open(argv[0]) as json_file:
        data = json.load(json_file)

    for sheetData in data:
        image_path = sheetData['path']
        img = cv.imread(image_path, cv.IMREAD_COLOR)

        try:
            # overlay sprite sheet over an equally sized black material: https://stackoverflow.com/a/14102014/5920409
            # I failed to come up with a more elegant way to get rid of the alpha channel while avoiding the underlying color artifacts.
            alpha = cv.imread(image_path, cv.IMREAD_UNCHANGED)[:,:,3] / 255.0
            # black = np.zeros((img.shape[0],img.shape[1],3), np.uint8)
            for c in range(0, 3):
                #img[:, :, c] = (alpha * img[:, :, c] + (1.0 - alpha) * black[:, :, c])
                img[:, :, c] = alpha * img[:, :, c]     # for a black background the commented out calculation gets reduced to this, as we're multiplying by 0
            img_black_ratio_limit = 0.95
            if(exceedsBlackRatio(img, img_black_ratio_limit)):   # if the source image is almost entirely black, invert it before overlaying.
                print('Image is over {}% black. Inverting colors.'.format(img_black_ratio_limit*100))
                img = cv.imread(image_path, cv.IMREAD_COLOR)
                alpha = cv.imread(image_path, cv.IMREAD_UNCHANGED)[:,:,3] / 255.0
                img = cv.bitwise_not(img)
                for c in range(0, 3):
                    img[:, :, c] = alpha * img[:, :, c]
        except IndexError:  # occurs if image has no alpha channel. In this case we can just take the image as is.
            pass

        if (img is None):
            print('Can\'t read the image')
            return -1

        img = cv.copyMakeBorder(img,IMG_PADDING_TOP,0,0,0,cv.BORDER_CONSTANT,value=0) # used to find faces in negative y area
        sheetData = calcFaces(img, sheetData)

    with open(argv[0], 'w') as json_file:
        json.dump(data, json_file)
    
    return 0
    
def calcFaces(img, sheetData):
    # finds most likely face dimensions (currently checks for [32 / 64 / ...])
    results = {}

    min_face_dim = 256   # minimum detectable face expression sprite size
    max_black_ratio = 0.75   # 25% of a face segment must be non-black to be used for matching
    min_match_face = 0.9 # face has to match another face by 90% or it unlikely to actually be a face
    min_match_face_body = 0.50

    SPRITE_FORMAT_NORMAL = 0            # a body sprite and at least one expression sprite below
    SPRITE_FORMAT_FULLBODY = 1          # full body sprites

    row_count = img.shape[0]    # = height
    max_y = row_count-1
    col_count = img.shape[1]    # = width
    max_x = col_count-1
    face_reference = None


    # recursive function to find a proper (=non-black) face sample for the given dimensions [dim x dim]
    def findFaceLeftBound(img, dim, _x1=0, _y1=None):
        # bottom left, using previous face as offset
        height = img.shape[0]
        width = img.shape[1]
        y1 = _y1 if _y1 is not None else height - dim
        x1 = _x1

        # if face exceeds right edge bounds, restart at upper row
        if(x1 >= width):
            x1 = 0
            y1 -= dim
        # if face exceeds bottom or top bounds, there is no face for these dimensions (y1 < 0 returns empty array even if y2 is in bounds)
        if(y1 >= height or y1 < 0):
            return None, None, None

        face = img[y1:y1+dim, x1:x1+dim]
        if(exceedsBlackRatio(face, max_black_ratio)):
            print("{} {} {} is too black.".format(dim, x1, y1))
            face, x1, y1 = findFaceLeftBound(img, dim, x1+dim, y1)
        return face, x1, y1

    d = min_face_dim
    while d*2 <= row_count and d*2 <= col_count:
        face1, f1x1, f1y1 = findFaceLeftBound(img, d)
        if(face1 is not None):
            face2, f2x1, f2y1 = findFaceLeftBound(img, d, f1x1+d, f1y1)
        if(face1 is not None and face2 is not None):
            # cv.namedWindow("{} face1 {} {}".format(d, f1x1, f1y1), cv.WINDOW_AUTOSIZE)
            # cv.imshow("{} face1 {} {}".format(d, f1x1, f1y1), face1)
            # cv.waitKey(0)
            # cv.namedWindow("{} face2 {} {}".format(d, f2x1, f2y1), cv.WINDOW_AUTOSIZE)
            # cv.imshow("{} face2 {} {}".format(d, f2x1, f2y1), face2)
            # cv.waitKey(0)
            matched = cv.matchTemplate(face1, face2, match_method)
            if(matched[0][0] > min_match_face):
                results[(d, "left")] = (matched[0][0], face1)
        else:
            print("Dimensions of {} skipped due to bad face samples.".format(d))
        d *= 2

    while(len(results) > 0):
        print(results)

        # Switched highest probability to smallest dimension. (Wrong) large dimensions tend to be rated too highly 
        # when compared to their neighbours and the results are already filtered for good probability.

        # highestProbabilityKey = max(results, key = lambda k : results.get(k)[0])   # get key of highest probability (large dimensions tend to rate too high though)
        smallestDimensionKey = min(results.keys(), key = lambda k : [k[0] for k in results.keys()])   # get key of smallest dimension from results
        dim = smallestDimensionKey[0]
        dirStr = smallestDimensionKey[1]
        certainty = results.get(smallestDimensionKey)[0]
        face_reference = results.get(smallestDimensionKey)[1]
        print("Most probable dimensions for this sprite sheet's faces:", dim, "aligned to the", dirStr, "side.")

        # find body height bottom to top. The first two rows missing a face are declared the bottom 
        # of the body sprite. This may causes extremely rare false positives on sprites missing a face 
        # on their first face slot of two following rows, but that's fine with me.
        y1 = row_count-dim
        y2 = row_count
        x1 = 0
        x2 = dim
        body_y = None
        y_offset = 0
        while(y1-y_offset > 0):
            face = img[ y1-y_offset   :   y2-y_offset , x1   :   x2]
            matched = cv.matchTemplate(face_reference, face, match_method)
            if(matched[0][0] < min_match_face):
                print("{} -> ({}, {}) => ({}, {}) is not a face. (Might be part of the body sprite.)"
                    .format(matched[0][0], x1, y1-y_offset, x2, y2-y_offset))
                if(body_y):     # stop scanning if we found missing faces on two rows in a row. (hah)
                    break
                body_y = y2-y_offset
                print("New Body sprite prediction: ({},{}) => ({},{})".format(0, 0, col_count, body_y))
            elif(body_y):
                body_y = None     # reset body prediction if we found a face on the following row.
                # win_name = "Face found on row"
                # cv.namedWindow( win_name, cv.WINDOW_AUTOSIZE )
                # cv.imshow(win_name, face)
                # cv.waitKey(0)
            y_offset += dim
        body = img[:body_y, :col_count]
        # bwin_name = "Body Prediction"
        # cv.namedWindow(bwin_name, cv.WINDOW_AUTOSIZE)
        # cv.imshow(bwin_name, body)
        # cv.waitKey(0)
        # face_ref_win_name = "Chosen Face Reference"
        # cv.namedWindow(face_ref_win_name, cv.WINDOW_AUTOSIZE)
        # cv.imshow(face_ref_win_name, face_reference)
        # cv.waitKey(0)

        # Do a final search for our reference face on our found body sprite. This sorts out some false positives.
        if(face_reference.shape[0] > 0 and face_reference.shape[1] > 0
                and body.shape[0] >= face_reference.shape[0] and body.shape[1] >= face_reference.shape[1]):
            face_body_match = cv.matchTemplate(body, face_reference, match_method)
            _minVal, maxVal, _minLoc, maxLoc = cv.minMaxLoc(face_body_match, None)
            if(maxVal < min_match_face_body):
                print("Failed to find face on body. Assuming false positive. ({})".format(maxVal))
                results.pop(smallestDimensionKey) # remove false positive from results
            else:
                certainty = (certainty+maxVal)/2
                matchLoc = maxLoc

                # final data for face.js. Everything seems to have gone well.
                sheetData["bodyHeight"] = body_y - IMG_PADDING_TOP  # subtracts image padding used to find faces in negative y
                sheetData["bodyWidth"] = col_count
                sheetData["eWidth"] = sheetData["eHeight"] = dim
                sheetData["headX"] = matchLoc[0]
                sheetData["headY"] = matchLoc[1] - IMG_PADDING_TOP # subtracts image padding used to find faces in negative y
                sheetData["dialogOffsetX"] = 0
                # No idea how to even estimate values for dialogOffsetY. 
                # Would probably need some big data set and some big maths. Or machine learning. 
                # Right now I just adjust values by hand as needed. Manual entries are mostly done by granting 10px of space 
                # above (physical) head. Could probably do something similiar programmically.
                # sheetData["dialogOffsetY"] = 0  
                sheetData["specialFormat"] = SPRITE_FORMAT_NORMAL
                sheetData["certainty"] = certainty
                break # we found our desired result, so break the result loop. Not pretty, I know.
        else:
            # This is just a fail safe from the past and might never actually happen in this project's current state,
            # but I can't be bothered checking right now.
            print("Invalid face and/or body dimensions.")
            sheetData["bodyHeight"] = row_count - IMG_PADDING_TOP # subtract image padding used to find faces in negative y
            sheetData["bodyWidth"] = col_count
            sheetData["specialFormat"] = SPRITE_FORMAT_FULLBODY
            sheetData["certainty"] = 0.0
    else:   # results became empty
        dim = None
        face_reference = None
        print("No probable faces detected. This is likely a full body sprite.")

        # final data for face.js if sheet is a full body sprite (= we failed to find face sprites)
        sheetData["bodyHeight"] = row_count - IMG_PADDING_TOP # subtracts image padding used to find faces in negative y
        sheetData["bodyWidth"] = col_count
        # sheetData["dialogOffsetX"] = 0
        # sheetData["dialogOffsetY"] = 0
        sheetData["specialFormat"] = SPRITE_FORMAT_FULLBODY   # full body sprite
        sheetData["certainty"] = 0.0
    print(sheetData)
    return sheetData
    
if __name__ == "__main__":
    main(sys.argv[1:])