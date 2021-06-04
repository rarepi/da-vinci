# Haar Cascade Anime Face Detection
import cv2 as cv
import numpy as np
import sys

# loading in the cascades.
face_cascade = cv.CascadeClassifier('lbpcascade_animeface.xml')

eye_cascade = cv.CascadeClassifier('haarcascade_eye.xml')

def exceedsBlackRatio(img, ratio):
    return cv.countNonZero(cv.cvtColor(img, cv.COLOR_BGR2GRAY)) < (1.0-ratio)*img.shape[0]*img.shape[1]

def main(argv):
    image_path = argv[0]
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

    # detection and drawing rectangles
    while True:
        #converting the image to grayscale for easier processing.
        gray = cv.cvtColor(img, cv.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        for (x, y, w, h) in faces:
            cv.rectangle(img, (x, y), (x+w, y+h), (255, 0, 0), 2)
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = img[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(roi_gray)
            for (ex, ey, ew, eh) in eyes:
                cv.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (0,255,0), 2)
        
        # Press 'ESC' to release the camera.        
        cv.imshow('img', img)
        k = cv.waitKey(30) & 0xff
        if k == 27:
            break

    cv.destroyAllWindows()

if __name__ == "__main__":
    main(sys.argv[1:])