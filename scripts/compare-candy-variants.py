"""Offline seam/flow comparison; optional numpy + OpenCV QA environment."""
import cv2, numpy as np,json
from pathlib import Path
out=Path('docs/video-tests/l03-candy-001')
results={}
for variant,suffix in [('original',''),('trim','_trim'),('xfade','_xfade')]:
 cap=cv2.VideoCapture(f'public/videos/level-03/l03_candy_001{suffix}.mp4'); fps=cap.get(cv2.CAP_PROP_FPS); frames=[]
 while True:
  ok,f=cap.read()
  if not ok:break
  frames.append(cv2.resize(f,(640,360)))
 cap.release();a=np.asarray(frames,dtype=np.float32)
 mask=np.zeros((360,640),np.uint8);cv2.fillPoly(mask,[np.array([[320,165],[540,359],[100,359]])],1);mask=mask.astype(bool)
 d=np.abs(a[1:]-a[:-1]); seam=np.abs(a[-1]-a[0])
 results[variant]={'frames':len(a),'fps':fps,'duration':len(a)/fps,'seamFullMAE':float(seam.mean()),'seamRoadMAE':float(seam[mask].mean()),'adjacentMedianFullMAE':float(np.median(d.mean(axis=(1,2,3)))),'adjacentMedianRoadMAE':float(np.median(d[:,mask].mean(axis=(1,2))))}
 indices=list(range(len(a)-4,len(a)))+list(range(4))
 tiles=[]
 for i in indices:
  tile=frames[i].copy();cv2.rectangle(tile,(0,0),(240,30),(20,30,20),-1);cv2.putText(tile,f'{variant}: frame {i} / {i/fps:.3f}s',(8,21),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1,cv2.LINE_AA);tiles.append(tile)
 cv2.imwrite(str(out/f'{variant}-seam-contact.jpg'),np.vstack([np.hstack(tiles[:4]),np.hstack(tiles[4:])]))
 if variant=='xfade':
  indices=list(range(len(a)-8,len(a)));tiles=[]
  for i in indices:
   tile=frames[i].copy();cv2.rectangle(tile,(0,0),(240,30),(20,30,20),-1);cv2.putText(tile,f'fade frame {i} / {i/fps:.3f}s',(8,21),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1,cv2.LINE_AA);tiles.append(tile)
  cv2.imwrite(str(out/'xfade-transition-contact.jpg'),np.vstack([np.hstack(tiles[:4]),np.hstack(tiles[4:])]))
(out/'variant-comparison.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
# Refit road K with the estimated median FOE, rather than the original .42 horizon.
base=json.loads((out/'offline-analysis.json').read_text());h=float(np.median([v['y'] for v in base['focusOfExpansion']]))
cap=cv2.VideoCapture('public/videos/level-03/l03_candy_001.mp4');gray=[]
while True:
 ok,f=cap.read()
 if not ok:break
 gray.append(cv2.cvtColor(cv2.resize(f,(640,360)),cv2.COLOR_BGR2GRAY))
flow=[]
for i in range(0,len(gray)-3,3):
 p=cv2.goodFeaturesToTrack(gray[i],180,.02,6,mask=mask.astype(np.uint8)*255)
 q,s,e=cv2.calcOpticalFlowPyrLK(gray[i],gray[i+3],p,None,winSize=(21,21),maxLevel=3)
 valid=(s[:,0]==1)&(e[:,0]<18);p=p[valid,0];q=q[valid,0];delta=q-p
 valid=(p[:,1]>180)&(p[:,1]<330)&(delta[:,1]>.2)&(np.linalg.norm(delta,axis=1)<70)
 p=p[valid];delta=delta[valid]
 if len(p)<8:continue
 k=(delta[:,1]/360/(3/24))/(p[:,1]/360-h)**2
 flow.append({'time':i/24,'medianK':float(np.median(k))})
medianK=float(np.median([p['medianK'] for p in flow]));summary={'horizon':h,'medianK':medianK,'speedForNear2':medianK*(1-h)*2,'kP10P90':np.percentile([p['medianK'] for p in flow],[10,90]).tolist(),'samples':flow,'limitations':'Planar-road, image-space estimate; ignores AI deformation and perspective ambiguity.'}
(out/'calibrated-flow.json').write_text(json.dumps(summary,indent=2)+'\n');print('Calibrated flow:',{k:v for k,v in summary.items() if k!='samples'})
