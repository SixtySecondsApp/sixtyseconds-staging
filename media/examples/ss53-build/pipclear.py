#!/usr/bin/env python3
"""Does anything intrude into the PiP's corner?

The PiP is the ONE element whose position is guaranteed across every film --
same corner, same size, same geometry, by the constraint that makes the hero
reel's argument work. So "nothing else may occupy that box" is trivially
assertable, and it should not depend on anyone remembering it is there.

It bit twice in one day: a wide CTA panel and a right-hand sequence panel both
ran under the circle, each caught only because a human happened to look at a
still. This turns that into a check.

METHOD. The circle sits inside a bounding box but does not fill it. The four
corners of that box are OUTSIDE the circle, so on a correct frame they show
dark page background. If a panel (a light page screenshot) has slid underneath,
those corners go bright. Sample them and assert they stay dark.

VALIDATED AGAINST A REAL FAILURE, which is the only kind of check worth having:
it fails on the pre-fix sequence frame and passes on the post-fix one.

  python3 pipclear.py <film.mp4 | frame.png> ...
"""
import subprocess, sys, pathlib, struct, zlib, tempfile, os

W, H = 1920, 1080
PIP_RIGHT, PIP_BOTTOM, PIP_SIZE = 96, 92, 292
X0, X1 = W - PIP_RIGHT - PIP_SIZE, W - PIP_RIGHT
Y0, Y1 = H - PIP_BOTTOM - PIP_SIZE, H - PIP_BOTTOM
PAD = 16          # corner patch size
LUMA_MAX = 78     # dark page ground; a white page screenshot is far above this

def frames(src, tmp):
    p = pathlib.Path(src)
    if p.suffix.lower() == ".png":
        return [str(p)]
    out = []
    d = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                        "-of","csv=p=0",str(p)],capture_output=True,text=True).stdout.strip()
    for pct in (25, 45, 62, 80):
        t = round(float(d) * pct / 100, 2)
        f = os.path.join(tmp, f"{p.stem}-{pct}.png")
        subprocess.run(["ffmpeg","-loglevel","error","-ss",str(t),"-i",str(p),
                        "-frames:v","1","-vf",f"scale={W}:{H}","-y",f],check=True)
        out.append(f)
    return out

def corner_luma(png):
    """Mean luma of the four PiP-bbox corners.

    Decodes each corner patch to raw 8-bit grey and averages it in Python. An
    earlier version parsed ffmpeg's signalstats metadata and silently returned
    0.0 whenever the parse missed -- which made the check report "ok" on a frame
    that was visibly failing. A check that cannot read its own instrument is a
    check that always passes.
    """
    vals = []
    for cx, cy in ((X0, Y0), (X1 - PAD, Y0), (X0, Y1 - PAD), (X1 - PAD, Y1 - PAD)):
        r = subprocess.run(
            ["ffmpeg","-v","error","-i",png,"-vf",
             f"scale={W}:{H},crop={PAD}:{PAD}:{cx}:{cy},format=gray",
             "-f","rawvideo","-"], capture_output=True)
        buf = r.stdout
        if len(buf) != PAD * PAD:
            raise SystemExit(f"pipclear: expected {PAD*PAD} bytes from {png}, got {len(buf)} "
                             f"-- refusing to report a result it could not measure")
        vals.append(sum(buf) / len(buf))
    return vals

def main(args):
    bad = 0
    with tempfile.TemporaryDirectory() as tmp:
        for src in args:
            for f in frames(src, tmp):
                v = corner_luma(f)
                worst = max(v)
                ok = worst <= LUMA_MAX
                if not ok: bad += 1
                print(f"{'ok  ' if ok else 'FAIL'} {pathlib.Path(f).name:34s} "
                      f"corner luma {[round(x) for x in v]}  worst {worst:.0f} / {LUMA_MAX}")
    print(f"\n{'PiP corner clear in every frame' if not bad else f'{bad} frame(s) have something under the PiP'}")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]) if len(sys.argv) > 1 else print(__doc__) or 0)
