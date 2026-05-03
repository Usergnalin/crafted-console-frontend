import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../api/client.jsx'

export default function Legal() {
  const { client } = useApi()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tosChecked, setTosChecked] = useState(false)
  const [eulaChecked, setEulaChecked] = useState(false)

  const bothChecked = tosChecked && eulaChecked

  const handleAccept = async () => {
    if (!bothChecked) return

    setLoading(true)
    setError('')

    try {
      await client.put('/auth/accept-legal')
      navigate('/dashboard')
    } catch (err) {
      console.error('Legal acceptance failed:', err)
      setError('Unable to accept legal terms. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary p-4">
      <div className="w-full max-w-6xl bg-bg-card border border-border-primary p-8 rounded-2xl shadow-xl">
        <div className="flex gap-6 mb-6">
          {/* Terms of Service - Left */}
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-semibold text-text-primary mb-3">Terms of Service</h2>
            <div className="flex-1 h-96 overflow-y-auto bg-bg-surface border border-border-secondary rounded-lg p-4 mb-4">
              <p className="text-text-secondary leading-relaxed mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis sem sed enim ultrices
                tristique. Integer sit amet urna vel arcu feugiat fermentum. Suspendisse potenti. Curabitur
                maximus libero ut sapien interdum, sit amet blandit ipsum convallis.
              </p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Aliquam in lectus et odio tincidunt suscipit. Donec sit amet nibh vitae velit vestibulum interdum.
                Sed consequat, risus non ullamcorper dignissim, libero odio tempor ipsum, quis dapibus sapien quam non mi.
              </p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Nulla facilisi. Proin ut orci nec metus luctus feugiat. Fusce euismod, orci eu sodales vestibulum,
                tellus lacus dapibus lorem, sit amet fermentum justo tortor at elit. Donec vulputate arcu vel velit
                molestie interdum. Nunc imperdiet ipsum eu enim aliquet, id aliquet dui fringilla.
              </p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tosChecked}
                onChange={(e) => setTosChecked(e.target.checked)}
                className="w-5 h-5 rounded border-border-secondary bg-bg-surface text-accent-primary focus:ring-accent-primary"
              />
              <span className="text-text-primary">I agree to the Terms of Service</span>
            </label>
          </div>

          {/* Minecraft EULA - Right */}
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-semibold text-text-primary mb-3">Minecraft End User License Agreement</h2>
            <div className="flex-1 h-96 overflow-y-auto bg-bg-surface border border-border-secondary rounded-lg p-4 mb-4">
              <p className="text-text-secondary leading-relaxed mb-4 font-bold">
                Minecraft End(er)-User License Agreement ("EULA")
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">SUMMARY</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                This EULA is a legal agreement between you and us (Mojang AB and Microsoft Corporation, or, if applicable, one of its local affiliates). You should read the whole thing but here is a quick summary:
              </p>
              <ul className="list-disc list-inside text-text-secondary mb-4 space-y-1">
                <li>This Minecraft EULA and the Microsoft Services Agreement apply to all Minecraft services.</li>
                <li>Your content is yours, but please share it responsibly and safely.</li>
                <li>Our community standards help us build a community that is open and safe for everyone.</li>
                <li>You may develop tools, plug-ins and services as long as they do not seem official or approved by us.</li>
                <li>Do not distribute or make commercial use of anything we've made without our permission.</li>
              </ul>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">ACCOUNT Terms</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                For Microsoft platforms, a Microsoft account is required to purchase our games or a Minecraft Realms subscription. The Microsoft Services Agreement has all the terms that apply to your Microsoft account.
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">What You Can and Can't Do</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                When you buy our games, you can download, install, and play them. However, you must not:
              </p>
              <ul className="list-disc list-inside text-text-secondary mb-4 space-y-1">
                <li>Give copies of our game software or content to anyone else</li>
                <li>Make commercial use of anything we've made</li>
                <li>Try to make money from anything we've made</li>
                <li>Let other people get access to anything we've made in an unfair or unreasonable way</li>
              </ul>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">Using Mods</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                If you've bought Minecraft: Java Edition, you may modify it by adding Mods. Mods are original creations that don't contain substantial parts of our copyrightable code. You may not distribute any Modded Versions of our game. Mods are okay to distribute; hacked versions are not.
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">Content</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Your Content remains Your Content. We don't own original things you create. However, we own copies or derivatives of our property - a single Minecraft block is ours; your Gothic Cathedral creation is yours.
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">Online Safety</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Please be careful when talking to people in our games. It's hard to know if people are who they say they are. Think twice about giving out personal information.
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">Community Standards</p>
              <p className="text-text-secondary leading-relaxed mb-2">Our Values:</p>
              <ol className="list-decimal list-inside text-text-secondary mb-4 space-y-1">
                <li>Minecraft is for everyone</li>
                <li>Diversity powers our community</li>
                <li>Playing with others should be safe and inclusive</li>
                <li>Hate has no place here</li>
              </ol>
              <p className="text-text-secondary leading-relaxed mb-4">
                We have a zero-tolerance policy towards hate speech, terrorist or violent extremist content, bullying, harassment, sexual solicitation, fraud, or threatening others. We reserve the right to suspend or permanently ban anyone who violates these standards.
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">Realms</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Minecraft Realms is our online service for playing on dedicated servers. Realms is a subscription service, not included with your purchase. You cannot sell, lease, rent, transfer, or give away access to your Realm. Your Content remains yours; we retain ownership of Minecraft intellectual property.
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">Privacy</p>
              <p className="text-text-secondary leading-relaxed mb-4">
                The Microsoft Privacy Statement applies to all Minecraft Services.
              </p>

              <p className="text-text-secondary leading-relaxed mb-2 font-semibold">Company Information</p>
              <p className="text-text-secondary leading-relaxed mb-1">Mojang AB</p>
              <p className="text-text-secondary leading-relaxed mb-1">Söder Mälarstrand 43</p>
              <p className="text-text-secondary leading-relaxed mb-1">SE-11825, Stockholm, Sweden</p>
              <p className="text-text-secondary leading-relaxed mb-4">Organization number: 556819-2388</p>

              <p className="text-text-secondary leading-relaxed mb-1">Microsoft Corporation</p>
              <p className="text-text-secondary leading-relaxed mb-1">One Microsoft Way</p>
              <p className="text-text-secondary leading-relaxed">Redmond, WA 98052-6399, U.S.A</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={eulaChecked}
                onChange={(e) => setEulaChecked(e.target.checked)}
                className="w-5 h-5 rounded border-border-secondary bg-bg-surface text-accent-primary focus:ring-accent-primary"
              />
              <span className="text-text-primary">I agree to the Minecraft EULA</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-900/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={loading || !bothChecked}
          className="w-full bg-accent-primary hover:bg-accent-hover text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Accepting...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
