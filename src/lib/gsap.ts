import gsap from 'gsap'
import ScrambleTextPlugin from 'gsap/ScrambleTextPlugin'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitText from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin)

export { gsap, ScrambleTextPlugin, ScrollTrigger, SplitText }
