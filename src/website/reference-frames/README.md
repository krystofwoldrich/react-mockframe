# Reference frames

Put device bezel images here to compare them with the generated frames in the playground (`pnpm dev`, then the **Reference frame** section in the sidebar). The playground shows the reference next to the frame or on top of it, at the same scale.

Everything in this folder except this README is git-ignored. The images are Apple's or Google's artwork, so keep them on your computer and do not commit them.

## Names

`<device>` is the name in the playground's device list, in lower case, with a dash for each space or other character:

| Device list name | `<device>` |
| --- | --- |
| iPhone 18 Pro | `iphone-18-pro` |
| iPhone 16 Pro | `iphone-16-pro` |
| iPad Pro 13-inch (M5) | `ipad-pro-13-inch-m5` |
| Pixel 10 Pro | `pixel-10-pro` |
| Pixel 9 Pro Fold | `pixel-9-pro-fold` |

The playground looks for the list entry name first, then for the name of the frame that draws it. For example, "iPhone 16 Pro" uses the iPhone 18 Pro frame, so `iphone-16-pro.png` and then `iphone-18-pro.png` are used. When no file matches, the sidebar shows the names it looks for.

## Files

**A bezel image:** `<device>.png` (or `.webp`, `.jpg`). The screen opening must be transparent and must include the center of the image. The playground finds the opening and scales the image so the opening has the width of the generated screen.

**A foldable pose:** `<device>--<pose>.png`, with the pose `closed`, `open`, or `half-open`. For example, `iphone-duo--closed.png` and `iphone-duo--open.png`. Without a pose-specific file, `<device>.png` is used for every pose.

**An Android Studio emulator skin:** copy the skin folder unchanged. Underscores in folder names count as dashes, so the original names work:

```sh
SKINS="/Applications/Android Studio.app/Contents/plugins/android/resources/device-art-resources"
cp -R "$SKINS/pixel_10_pro" "$SKINS/pixel_9_pro" "$SKINS/pixel_9_pro_fold" "$SKINS/pixel_10_pro_fold" .
```

A skin folder has `back.webp` (the frame), `mask.webp` (the screen corners), and `layout` (the screen position). The playground draws the mask over the frame, as the emulator does. Foldable skins have a `closed/` folder and a `default/` folder; `default/` is used for the open pose.

## Where to get references

- Apple: the device bezels from [Apple Design Resources](https://developer.apple.com/design/resources/). Rename each PNG to `<device>.png`.
- Google: the emulator skins in Android Studio, at the path above. The same files are in the AOSP repository `platform/tools/adt/idea`, folder `artwork/resources/device-art-resources`.

Check the license terms of each source before you use the images anywhere else.

## Orientation

If the generated screen is landscape and the reference screen is portrait (or the other way around), the reference is turned 90° counter-clockwise, as the frames turn for landscape.
