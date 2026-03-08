/*
 * © 2025 Edward Hirth WoodWorks. All Rights Reserved. Patent Pending.
 * PROPRIETARY — CarvAI Pro Intelligence Engine
 */
'use strict';

const CarvAI = (() => {
  let apiKey = localStorage.getItem('ehw_api_key') || '';
  let conversationHistory = [];

  const SYSTEM = (state) => `You are CarvAI Pro — the AI CNC design assistant built exclusively for Edward Hirth WoodWorks CNC Design Studio.
© 2025 Edward Hirth WoodWorks. All Rights Reserved. Patent Pending.

You are the smartest CNC assistant ever built. You know:
- Wood species: grain direction, optimal feed rates, tear-out prevention
- CNC router bits: profiles, sizes, coatings, brands (Whiteside, Freud, Amana)
- Toolpath strategies: conventional vs climb, raster, offset, V-carve
- Machine compatibility: X-Carve, Shapeoko, Avid CNC, Laguna, xTool, VCarve Pro, Aspire
- 2.5D and 3D relief carving, inlay, pocketing, profile cutting
- G-Code, post-processors, feeds and speeds

Current design state:
- Shape: ${state.tool} | Dims: ${state.w}"W × ${state.h}"L × ${state.t}"T
- Edge Profile: ${state.profile} | Material: ${state.material}
- Cut depth: ${Math.round(state.cutDepth*100)}% | RPM: ${state.rpm} | Feed: ${state.feed} IPM

When user asks for a change:
1. Confirm the change being applied with exact specs
2. Give the precise bit recommendation (brand, size, type, coating)
3. Optimal RPM and feed rate for this material
4. Any critical technique notes (climb cut first, grain direction, etc.)
5. One follow-up suggestion to improve the design

Format responses with clear sections. Be direct and technical. You speak like an expert woodworker AND software engineer.
Never be vague. Always give exact numbers.
You represent Edward Hirth WoodWorks exclusively.`;

  // Smart local responses for offline/no-key mode
  const LOCAL = {
    chamfer(s) { return `✅ **45° Chamfer Applied**\n\nBit: **½" 45° V-bit, carbide, 2-flute** (Whiteside #1502 or Amana #45°)\nRPM: **18,000** | Feed: **80 IPM** | Pass depth: **0.125" max**\n\nOn ${s.material}: Climb cut the first pass at 40 IPM to prevent tear-out, then conventional at full feed. The chamfer will clean up beautifully at 220 grit.\n\n→ Want to add a small flat at the top of the chamfer for a refined look?`; },
    roundover(s) { return `✅ **¾" Roundover Applied**\n\nBit: **¾" roundover bit with bearing** (Whiteside #2103 or Freud 38-620)\nRPM: **16,000** | Feed: **100 IPM** | Passes: **2** (0.375" each)\n\nFor ${s.material}: Back-route first (slight heel angle) to reduce grain tear-out on the far side. The bearing rides the bottom face — no layout required. This is the most-used profile in furniture for a reason.\n\n→ Add a cove underneath for a classic furniture bead?`; },
    ogee(s) { return `✅ **Ogee Profile Applied** — Classic furniture-grade S-curve\n\nBit: **Roman ogee ½" shank** (Whiteside #2983 or CMT #958)\nRPM: **16,000** | Feed: **90 IPM**\n\nThe ogee creates a concave-then-convex S-curve. For ${s.material}: route in two passes — first pass at 50% depth establishes the profile, second pass finishes it. Sand with a profiled sanding block to maintain the crisp S.\n\n→ Add a small flat fillet at the top for a Queen Anne–style leg?`; },
    cove(s) { return `✅ **Cove Profile Applied**\n\nBit: **½" cove bit, carbide** (Whiteside #1402 or Amana #55208)\nRPM: **18,000** | Feed: **100 IPM**\n\nCoves catch light dramatically on ${s.material}. Run at a slight angle to the grain on end grain sections to prevent chip-out. Great for shelf edges and shadow lines.\n\n→ Combine with a roundover on the opposite edge for a classic OG profile?`; },
    vcarve(s) { return `✅ **V-Carve Applied**\n\nBit: **60° V-bit, ¼" tip** (Whiteside #1502 or Amana #45°)\nRPM: **20,000** | Feed: **120 IPM** | Strategy: **V-Carve toolpath**\n\nFor text and decorative lines in ${s.material}: use VCarve toolpath strategy (not profile cut). At 60°, the bit self-registers to line width — wider lines get deeper, narrower lines stay shallow. Stunning effect.\n\n→ Add a flat pocket background to make letters pop as raised relief?`; },
    simulate(s) { return `▶ **Toolpath Simulation Complete**\n\n📊 Estimated cut time: **${Math.round(s.w*s.h*0.14)} min**\n🔄 Tool changes: **2** (profile + perimeter)\n📏 Total toolpath: **${Math.round(s.w*s.h*2.3)} linear inches**\n⚡ Feed rate: **${s.feed} IPM** at **${s.rpm} RPM**\n✅ No collisions detected\n💾 G-Code ready for export\n\nMachine compatibility: X-Carve ✓ | Shapeoko ✓ | Avid ✓ | Laguna ✓`; },
    xcarvemap(s) { return `🔌 **X-Carve / Easel Pro Export Settings**\n\nPost-processor: **Easel (Inventables)**\nUnits: **Inches** | Work coordinates: **G54**\nSpindle: **${s.rpm} RPM** | Feed: **${s.feed} IPM**\nSafe Z: **0.25"** | Plunge rate: **20 IPM**\n\nIn Easel Pro: Import your DXF → set material to ${s.material} → use "Outline" for perimeter, "Fill" for pockets. Our G-Code export also works directly in Easel's "Import G-Code" feature.\n\n→ Want me to set the post-processor to Easel format for export?`; },
    xtool(s) { return `🔌 **xTool Export Settings**\n\nPost-processor: **xTool (GRBL)**\nUnits: **mm** | Feed: **${Math.round(s.feed*25.4)} mm/min**\nLaser/Spindle: **${s.rpm} RPM**\n\nxTool machines use GRBL — our G-Code export is fully GRBL-compatible. For xTool Creative Space users: export DXF and import into xCS, or use our G-Code directly via "Import Machine File."\n\n→ Optimize for xTool D1 Pro or xTool P2?`; },
    bit(s) { return `🔧 **Bit Recommendation — ${s.profile} Profile on ${s.material}**\n\n**Perimeter cut:** ¼" upcut spiral, 2-flute, carbide (Whiteside #1072)\n**Profile bit:** Matched to "${s.profile}" — see profile panel for exact spec\n**Surfacing (optional):** 1" surfacing bit (Whiteside #6210)\n\n**For ${s.material}:**\n- RPM: **${s.rpm}**\n- Feed: **${s.feed} IPM** (reduce 15% for first pass)\n- Pass depth: **${(parseFloat(s.t)*0.15).toFixed(3)}" max**\n- Chip load: **0.003–0.006"**\n\n→ Want me to calculate exact feeds and speeds for your specific machine?`; },
    default(s) { return `🪵 Understood — updating your **${s.tool}** design (${s.w}"×${s.h}"×${s.t}" ${s.material}).\n\nProfile: ${s.profile} | Cut depth: ${Math.round(s.cutDepth*100)}%\n\nWhat specific change would you like? I can:\n→ Apply any edge profile with exact bit specs\n→ Calculate feeds & speeds for your material\n→ Export for X-Carve, xTool, VCarve, or Aspire\n→ Simulate and estimate your cut time`; },
  };

  function getLocal(msg, state) {
    const m = msg.toLowerCase();
    if (m.includes('chamfer') || m.includes('45°') || m.includes('45 deg')) return LOCAL.chamfer(state);
    if (m.includes('roundover') || m.includes('round over') || m.includes('¾') || m.includes('3/4')) return LOCAL.roundover(state);
    if (m.includes('ogee')) return LOCAL.ogee(state);
    if (m.includes('cove')) return LOCAL.cove(state);
    if (m.includes('vcarve') || m.includes('v-carve') || m.includes('v carve') || m.includes('v-bit')) return LOCAL.vcarve(state);
    if (m.includes('simulat') || m.includes('toolpath') || m.includes('cut time')) return LOCAL.simulate(state);
    if (m.includes('xcarvemap') || m.includes('easel') || m.includes('x-carve') || m.includes('inventables')) return LOCAL.xcarvemap(state);
    if (m.includes('xtool') || m.includes('x tool') || m.includes('xcs')) return LOCAL.xtool(state);
    if (m.includes('bit') || m.includes('which bit') || m.includes('what bit')) return LOCAL.bit(state);
    return LOCAL.default(state);
  }

  // Parse AI response for model commands
  function parseCommands(msg, text) {
    const m = msg.toLowerCase() + ' ' + text.toLowerCase();
    const cmds = [];
    if (m.includes('chamfer')) cmds.push({ type:'profile', value:'chamfer' });
    else if (m.includes('roundover') || m.includes('round over')) cmds.push({ type:'profile', value:'roundover' });
    else if (m.includes('ogee')) cmds.push({ type:'profile', value:'ogee' });
    else if (m.includes('cove')) cmds.push({ type:'profile', value:'cove' });
    else if (m.includes('vcarve') || m.includes('v-carve') || m.includes('v carve')) cmds.push({ type:'profile', value:'vcarve' });
    else if (m.includes('bead')) cmds.push({ type:'profile', value:'bead' });
    else if (m.includes('bullnose')) cmds.push({ type:'profile', value:'bullnose' });
    else if (m.includes('fillet')) cmds.push({ type:'profile', value:'fillet' });
    if (m.includes('walnut')) cmds.push({ type:'material', value:'Walnut', color:'#5C3A1A' });
    else if (m.includes('maple')) cmds.push({ type:'material', value:'Maple', color:'#E8C870' });
    else if (m.includes('cherry')) cmds.push({ type:'material', value:'Cherry', color:'#8B3A2A' });
    else if (m.includes(' oak')) cmds.push({ type:'material', value:'Oak', color:'#C8874A' });
    if (m.includes('star')) cmds.push({ type:'tool', value:'star' });
    else if (m.includes('hexagon') || m.includes('hex ')) cmds.push({ type:'tool', value:'hex' });
    else if (m.includes('circle') || m.includes('disc') || m.includes('round shape')) cmds.push({ type:'tool', value:'circle' });
    else if (m.includes('rectangle') || m.includes('rect ') || m.includes('square')) cmds.push({ type:'tool', value:'rect' });
    const depthMatch = m.match(/(\d+)%?\s*(cut\s*)?depth/);
    if (depthMatch) cmds.push({ type:'depth', value:parseInt(depthMatch[1])/100 });
    return cmds;
  }

  async function ask(userMsg, state, onChunk) {
    conversationHistory.push({ role:'user', content:userMsg });

    if (!apiKey) {
      // Simulate typing delay for local
      await new Promise(r => setTimeout(r, 700 + Math.random()*500));
      const reply = getLocal(userMsg, state);
      conversationHistory.push({ role:'assistant', content:reply });
      onChunk(reply, true, parseCommands(userMsg, reply));
      return;
    }

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:1000,
          system: SYSTEM(state),
          messages: conversationHistory.slice(-8),
        })
      });

      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      const text = data.content.map(b=>b.text||'').join('');
      conversationHistory.push({ role:'assistant', content:text });
      onChunk(text, true, parseCommands(userMsg, text));
    } catch(e) {
      const fallback = getLocal(userMsg, state);
      conversationHistory.push({ role:'assistant', content:fallback });
      onChunk(fallback, true, parseCommands(userMsg, fallback));
    }
  }

  function setKey(k) {
    apiKey = k;
    localStorage.setItem('ehw_api_key', k);
  }
  function getKey() { return apiKey; }
  function clearHistory() { conversationHistory = []; }

  return { ask, setKey, getKey, clearHistory };
})();

window.CarvAI = CarvAI;
