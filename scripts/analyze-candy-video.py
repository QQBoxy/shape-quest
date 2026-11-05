"""Optional offline QA: run with numpy + opencv-python-headless, not a game dependency."""
import cv2, numpy as np, json, argparse
parser=argparse.ArgumentParser()
parser.add_argument('--source',default='public/videos/level-03/l03_candy_001_poc_72f19161.mp4')
parser.add_argument('--out',default='docs/video-tests/l03-candy-001-v2')
args=parser.parse_args()
from pathlib import Path
source = Path(args.source)
out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
cap = cv2.VideoCapture(str(source)); fps = cap.get(cv2.CAP_PROP_FPS)
frames=[]
while True:
 ok, frame = cap.read()
 if not ok: break
 frames.append(cv2.resize(frame,(640,360)))
cap.release()
f=np.asarray(frames).astype(np.float32)
# Conservative center-road polygon excludes most decorative scenery.
mask=np.zeros((360,640),np.uint8)
cv2.fillPoly(mask,[np.array([[320,165],[540,359],[100,359]])],1)
mask=mask.astype(bool)
def diff(a,b): return {'fullMAE':float(np.abs(a-b).mean()), 'roadMAE':float(np.abs(a-b)[mask].mean())}
adj=[diff(f[i],f[i+1]) for i in range(len(f)-1)]
candidates=[]
for start in range(25):
 for end in range(len(f)-25,len(f)):
  if end-start < 144: continue
  d=diff(f[end],f[start]); candidates.append((.6*d['roadMAE']+.4*d['fullMAE'],start,end,d))
best=min(candidates)
# Track road texture through short intervals. K = dv / (v-horizon)^2 is
# constant for a planar road under fixed forward camera motion.
flow=[]; vp=[]; pts=[]
for i in range(0,len(f)-3,3):
 a=cv2.cvtColor(frames[i],cv2.COLOR_BGR2GRAY); b=cv2.cvtColor(frames[i+3],cv2.COLOR_BGR2GRAY)
 p=cv2.goodFeaturesToTrack(a,180,.02,6,mask=mask.astype(np.uint8)*255)
 if p is None: continue
 q,status,err=cv2.calcOpticalFlowPyrLK(a,b,p,None,winSize=(21,21),maxLevel=3)
 valid=(status[:,0]==1)&(err[:,0]<18)
 p=p[valid,0]; q=q[valid,0]; delta=q-p
 valid=(p[:,1]>180)&(p[:,1]<330)&(delta[:,1]>.2)&(np.linalg.norm(delta,axis=1)<70)
 p=p[valid];delta=delta[valid]
 if len(p)<8: continue
 # Fit optical-flow rays to a focus of expansion, using repeated least squares.
 A=np.c_[-delta[:,1],delta[:,0]]; y=(A*p).sum(axis=1)
 v=np.linalg.lstsq(A,y,rcond=None)[0]
 residual=np.abs(A@v-y)/(np.linalg.norm(A,axis=1)+1e-6)
 inliers=residual<np.median(residual)*2+1
 if inliers.sum()>6: v=np.linalg.lstsq(A[inliers],y[inliers],rcond=None)[0]
 vp.append({'time':i/fps,'x':float(v[0]/640),'y':float(v[1]/360),'tracks':int(len(p))})
 # Initial fixed horizon from spec, independent from the fit above.
 normv=p[:,1]/360; dv=delta[:,1]/360/(3/fps)
 k=dv/(normv-.42)**2
 flow.append({'time':i/fps,'medianK':float(np.median(k)), 'medianDownPixelsPerSecond':float(np.median(delta[:,1])/(3/fps)), 'tracks':int(len(p))})
 # Draw example road flow at t=3s, for manual review.
 if i==72:
  image=frames[i].copy()
  for p0,d in zip(p,delta): cv2.arrowedLine(image,tuple(p0.astype(int)),tuple((p0+d*2).astype(int)),(20,255,20),1,tipLength=.2)
  cv2.imwrite(str(out/'road-flow-3s.jpg'),image)
result={
 'source':str(source),'videoFrames':len(f),'fps':fps,'videoDuration':len(f)/fps,
 'seam':diff(f[-1],f[0]),
 'adjacentMedian':{k:float(np.median([d[k] for d in adj])) for k in adj[0]},
 'bestTrim':{'startFrame':best[1],'lastFrame':best[2],'duration':(best[2]-best[1]+1)/fps,**best[3]},
 'flow':flow,'focusOfExpansion':vp,
 'limitations':'Pixel MAE is not perceptual seamlessness. Flow is a noisy image-space estimate, not real 3D calibration. Mask and horizon are provisional.'}
(out/'offline-analysis.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['flow','focusOfExpansion']},indent=2))
print('Flow K median:', np.median([d['medianK'] for d in flow]))
print('Focus median:', np.median([[v['x'],v['y']] for v in vp],axis=0))
