export interface EffectField {
  name: string
  label: string
  placeholder?: string
  type?: 'text' | 'checkbox'
}

export interface EffectDefinition {
  id: string
  label: string
  fields?: EffectField[]
  defaults?: Record<string, string | number | boolean>
}

const text = (name = 'caption', label = 'Text', placeholder = 'Type something…'): EffectField => ({
  name, label, placeholder, type: 'text',
})

export const effects: EffectDefinition[] = [
  { id: 'blur', label: 'Blur' },
  { id: 'sharpen', label: 'Sharpen' },
  { id: 'flip', label: 'Flip' },
  { id: 'flop', label: 'Flop' },
  { id: 'invert', label: 'Invert' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'hue', label: 'Hue shift', defaults: { shift: 90 } },
  { id: 'deepfry', label: 'Deep fry' },
  { id: 'jpeg', label: 'JPEG', defaults: { quality: 8 } },
  { id: 'pixelate', label: 'Pixelate' },
  { id: 'stretch', label: 'Stretch' },
  { id: 'wide', label: 'Wide', defaults: { amount: 2 } },
  { id: 'rotate', label: 'Rotate', defaults: { angle: 90 } },
  { id: 'crop', label: 'Square crop' },
  { id: 'tile', label: 'Tile' },
  { id: 'caption', label: 'Caption', fields: [text()] },
  { id: 'caption2', label: 'Bottom caption', fields: [text(), { name: 'top', label: 'Put it on top', type: 'checkbox' }] },
  { id: 'meme', label: 'Meme', fields: [text('topText', 'Top text'), text('bottomText', 'Bottom text')] },
  { id: 'motivate', label: 'Motivational poster', fields: [text('topText', 'Title'), text('bottomText', 'Subtitle')] },
  { id: 'snapchat', label: 'Snapchat caption', fields: [text()] },
  { id: 'whisper', label: 'Whisper caption', fields: [text()] },
  { id: 'reddit', label: 'Reddit header', fields: [text('caption', 'Subreddit', 'memes')] },
  { id: 'spotify', label: 'Spotify header', fields: [text('caption', 'Title', 'This is…')] },
  { id: 'uncanny', label: 'Uncanny', fields: [text('caption', 'Left text'), text('caption2', 'Right text')], defaults: { phase: 'normal' } },
  { id: 'gamexplain', label: 'GameXplain' },
  { id: 'scott', label: 'Scott the Woz' },
  { id: 'flag', label: 'Flag overlay', fields: [text('flag', 'Flag', '🇺🇸')], defaults: { flag: '🇺🇸' } },
  { id: 'speechbubble', label: 'Speech bubble' },
  { id: 'vignette', label: 'Vignette' },
  { id: '9gag', label: '9GAG watermark' },
  { id: 'avs4you', label: 'AVS4YOU watermark' },
  { id: 'bandicam', label: 'Bandicam watermark' },
  { id: 'deviantart', label: 'DeviantArt watermark' },
  { id: 'funky', label: 'New Funky Mode' },
  { id: 'hypercam', label: 'HyperCam watermark' },
  { id: 'ifunny', label: 'iFunny watermark' },
  { id: 'kinemaster', label: 'KineMaster watermark' },
  { id: 'memecenter', label: 'MemeCenter watermark' },
  { id: 'powerdirector', label: 'PowerDirector watermark' },
  { id: 'shutterstock', label: 'Shutterstock watermark' },
]

export const defaultEffect = effects[0]!
