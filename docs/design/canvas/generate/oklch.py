import math
def oklch_to_hex(L,C,h):
    a=C*math.cos(math.radians(h)); b=C*math.sin(math.radians(h))
    l_=L+0.3963377774*a+0.2158037573*b
    m_=L-0.1055613458*a-0.0638541728*b
    s_=L-0.0894841775*a-1.2914855480*b
    l=l_**3; m=m_**3; s=s_**3
    r= 4.0767416621*l-3.3077115913*m+0.2309699292*s
    g=-1.2684380046*l+2.6097574011*m-0.3413193965*s
    bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    def gam(c):
        c=max(0,min(1,c))
        return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
    def clip(c): return max(0,min(1,c))
    out=[gam(clip(c)) for c in (r,g,bb)]
    return '#%02X%02X%02X'%tuple(round(c*255) for c in out), (r,g,bb)
import sys
rows=[l.split() for l in sys.stdin if l.strip() and not l.startswith('#')]
for name,L,C,h in rows:
    hx,raw=oklch_to_hex(float(L),float(C),float(h))
    gamut='' if all(-0.002<=c<=1.002 for c in raw) else '  (fora do gamut sRGB — clipado)'
    print(f'{name:28s} oklch({L} {C} {h}) -> {hx}{gamut}')
