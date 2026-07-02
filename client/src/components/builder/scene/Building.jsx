import BuildingRoof, { getRoofSkylightBases } from './BuildingRoof'
import BuildingWalls, { getWallSkylightBases } from './BuildingWalls'
import SkylightSurface       from './Skylight'
import BuildingColumns        from './BuildingColumns'
import { RoofPurlins, WallGirts, StructuralFrames, DiagonalBraces, BaseRails, TubeWallContext, roofLift } from './BuildingTrusses'
import BuildingHardware        from './BuildingHardware'
import BuildingScrews          from './BuildingScrews'
import TrimMesh               from './TrimMesh'
import ExtendedGableCanopy    from './ExtendedGableCanopy'
import BuildingLeanTo, { LeanToCorner } from './BuildingLeanTo'
import BuildingInteriorWalls from './BuildingInteriorWalls'
import BuildingFoundation, { LeanToFoundation } from './BuildingFoundation'
import BuildingOpenings        from './BuildingOpenings'
import Exploded                from './Exploded'
import { PieceInspectProvider } from './PieceInspect'
import FreeStandingLeanTo     from './FreeStandingLeanTo'
import Telehandler            from './Telehandler'
import DeliveryRig            from './DeliveryRig'
import DeliveryAccessRing     from './DeliveryAccessRing'
import ScissorLift            from './ScissorLift'
import DraggableProp          from './DraggableProp'
import { deriveStructure, SURFACE_ANCHORS, installRequirements } from '../../../data/structural'

function extendFt(wallStyle) {
  const m = wallStyle?.match(/^extended_gable_(\d+)$/)
  return m ? Number(m[1]) : 0
}

export default function Building({ config }) {
  const {
    width, length, height, roofPitch, lowEaveHeight,
    walls, doors,
    roofColor, wallColor, trimColor,
    wainscotEnabled, wainscotColor, wainscotWalls,
    wallOrientation,
    leanTos,
    viewMode,
    widespanTrussStyle,
    panelProfile,
    showAnchors,
  } = config

  // Roof-style limits: Regular & A-frame Horizontal are capped at 30′ LONG, and
  // Regular can't go over 30′ WIDE. Anything past those is forced to the widespan
  // A-frame Vertical so the truss, roof skin and gables stay consistent.
  const cfgRoof = config.roofStyle
  const forceVertical =
    (width > 30 && cfgRoof === 'regular') ||
    (length > 30 && (cfgRoof === 'regular' || cfgRoof === 'a_frame_horizontal'))
  const roofStyle = forceVertical ? 'a_frame_vertical' : cfgRoof

  const pitchAngle  = Math.atan(roofPitch / 12)
  const ridgeHeight = height + (width / 2) * Math.tan(pitchAngle)
  const frameOnly   = viewMode === 'wireframe'

  // Size/rating → leg type, truss type, frame spacing, bracing
  const structure = deriveStructure(config)

  // Site equipment counts: telehandler only when >30′ wide, scissor lift only when
  // >12′ tall; either jumps to 2 when >40′ wide (matches the Install Requirements
  // readout in the panel). 0 = not shown. STRICTLY size-driven: the customer's
  // "Install Equipment to Provide" counts (scissorLiftCount / telehandlerCount) are
  // quote info only — they can't add or remove the staged rigs from the scene.
  const req = installRequirements(config)
  const scissorQty     = req.scissorQty
  const telehandlerQty = req.telehandlerQty

  // Foundation surface (concrete forced when oversize) + a valid anchor for it
  const effSurface   = (width > 30 || height > 12) ? 'concrete' : config.installationSurface
  const validAnchors = SURFACE_ANCHORS[effSurface] ?? []
  const anchorType   = validAnchors.includes(config.anchorType) ? config.anchorType : validAnchors[0]

  const frontExtend = extendFt(walls.front)
  const backExtend  = extendFt(walls.back)
  const halfLength  = length / 2

  // Per-component show/hide (Components panel). Missing key → visible.
  const vis  = config.componentVisibility ?? {}
  const show = (k) => vis[k] !== false

  // Per-INSTANCE show/hide (granular tree). Map of instance id → true (hidden).
  // Renderers skip an instance when its id is in here (its TYPE must still be on).
  const hiddenInstances = config.hiddenInstances ?? {}

  // Over 30′ wide → girts + purlins are 2½″ SQUARE TUBE (not hat channel).
  // Applies to the center building AND any lean-to attachments.
  const squareSecondary = width > 30

  // Free-standing lean-to: a single-slope building (its own posts both sides).
  // Now selected via the Roof Style picker ('free_standing_lean_to').
  if (config.roofStyle === 'free_standing_lean_to') {
    return (
      <TubeWallContext.Provider value={structure.tubeWall}>
        <group>
          {show('foundation') && <BuildingFoundation width={width} length={length} structure={structure} walls={walls} surface={effSurface} anchorType={anchorType} slabEdge={config.slabEdge} showAnchors={showAnchors} trimColor={trimColor.hex} />}
          <FreeStandingLeanTo
            width={width} length={length} height={height} roofPitch={roofPitch} lowEave={lowEaveHeight}
            walls={walls} roofColor={roofColor.hex} wallColor={wallColor.hex} trimColor={trimColor.hex}
            wallOrientation={wallOrientation}
            panelProfile={panelProfile} frameOnly={frameOnly}
            wainscotEnabled={wainscotEnabled && show('wainscot')} wainscotColor={wainscotColor.hex} wainscotWalls={show('wainscot') ? wainscotWalls : {}}
          />
        </group>
      </TubeWallContext.Provider>
    )
  }

  // Truck & trailer default staging spot (off the front-left corner). Shared by the
  // draggable prop and the 40′ delivery-access ring so both stay in sync.
  const deliveryDefaultPos = [-width / 2 - 18, 0, -length / 2 - 62]
  const deliveryDefaultRot = Math.PI / 2

  return (
    <TubeWallContext.Provider value={structure.tubeWall}>
    <PieceInspectProvider>
    <group>
      {/* ── Foundation slab + per-post anchors ── */}
      {show('foundation') && <Exploded id="foundation"><BuildingFoundation width={width} length={length} structure={structure} walls={walls} surface={effSurface} anchorType={anchorType} slabEdge={config.slabEdge} showAnchors={showAnchors} trimColor={trimColor.hex} /></Exploded>}

      {/* ── Per-lean-to foundation pads: each enabled lean-to gets its own pad on
            its chosen surface (null → inherits the main building's surface). ── */}
      {show('foundation') && ['left', 'right', 'front', 'back'].map((side) => {
        const lt = leanTos?.[side]
        if (!lt?.enabled) return null
        if (config.hiddenParts?.[`leanTos#${side}`]) return null
        const ltSurface = lt.surface ?? effSurface
        const ltAnchor  = lt.surface ? (SURFACE_ANCHORS[ltSurface]?.[0] ?? 'pin') : anchorType
        return (
          <LeanToFoundation
            key={side} side={side}
            mainWidth={width} length={length} leanWidth={lt.width}
            frameSpacing={structure.spacing}
            surface={ltSurface} anchorType={ltAnchor} showAnchors={showAnchors}
          />
        )
      })}

      {/* ── Base rail: along each closed wall, the column feet seat into it. Cut
            where a floor-standing opening (door / roll-up) crosses it. ── */}
      {show('baseRails') && <Exploded id="baseRails"><BaseRails width={width} length={length} walls={walls} doors={doors} hiddenInstances={hiddenInstances} /></Exploded>}

      {/* ── Columns: side legs by size + rating, plus closed-end posts + the gable
            brace [20] on partially-enclosed ends. Posts that fall inside an opening
            are skipped (the frame-out jambs frame it). ── */}
      {(show('sideLegs') || show('endPosts') || show('gableBraces')) && (
        <Exploded id="sideLegs">
          <BuildingColumns width={width} length={length} height={height} ridgeHeight={ridgeHeight} structure={structure} walls={walls} doors={doors} showSide={show('sideLegs')} showEnd={show('endPosts')} showGableBrace={show('gableBraces')} hiddenInstances={hiddenInstances} />
        </Exploded>
      )}

      {/* ── Door / window frame-outs: jamb posts + header (double on end walls) +
            cripples — even on walls that carry roll-up doors. ── */}
      {show('frames') && <Exploded id="doors"><BuildingOpenings width={width} length={length} height={height} ridgeHeight={ridgeHeight} doors={doors} /></Exploded>}

      {/* ── Structural frames: single or double truss (A-frame or rounded bow) ── */}
      {show('frames') && <Exploded id="frames"><StructuralFrames width={width} length={length} height={height} ridgeHeight={ridgeHeight} roofStyle={roofStyle} structure={structure} widespanStyle={widespanTrussStyle} hiddenInstances={hiddenInstances} /></Exploded>}

      {/* ── Connection hardware: brackets / clips / plate gussets / connector
            sleeves / king-post peak gusset + A325 bolts + SDS screw markers at the
            real joints. Instanced (one draw call per type); rides with the frame in
            ALL views (normal / frame / diagnostic). Skips a joint whose parent leg
            or truss is hidden via hiddenInstances. ── */}
      {show('frames') && (
        <Exploded id="frames">
          <BuildingHardware
            width={width} length={length} height={height} ridgeHeight={ridgeHeight}
            roofStyle={roofStyle} structure={structure} walls={walls} doors={doors}
            windSpeed={config.windSpeed} hiddenInstances={hiddenInstances}
            config={config}
          />
        </Exploded>
      )}

      {/* ── Screw layer (DIAGNOSTIC VIEW only): hex-head markers on every fastening
            line — panel→purlin/girt, purlin→rafter, girt→post, trim runs, brace
            gusset plates, and all of it repeated on the lean-to wings. Instanced
            (six draw calls total); each family explodes with its parent layer. ── */}
      <BuildingScrews
        width={width} length={length} height={height} ridgeHeight={ridgeHeight}
        roofStyle={roofStyle} structure={structure} walls={walls} doors={doors}
        wallOrientation={wallOrientation} vis={vis} frameOnly={frameOnly}
        config={config}
      />

      {/* ── Roof purlins: only A-Frame Vertical (vertical panels need purlins to ──
          ── screw into; horizontal & regular panels fasten straight to the bows) ── */}
      {show('purlins') && roofStyle === 'a_frame_vertical' && (
        <Exploded id="purlins">
          <RoofPurlins width={width} length={length} height={height} ridgeHeight={ridgeHeight} spacing={structure.purlinSpacing} hiddenParts={config.hiddenParts} hiddenInstances={hiddenInstances} square={squareSecondary} />
        </Exploded>
      )}

      {/* ── Diagonal sway braces: shown only when selected (Side Bracing toggle),
          ── identical in frame-only and clad views so the two stay in sync ── */}
      {show('braces') && structure.bracing === 'diagonal' && (
        <Exploded id="braces">
          <DiagonalBraces width={width} length={length} height={height} spacing={structure.spacing} endSpacing={structure.endPostSpacing} walls={walls} doors={doors} />
        </Exploded>
      )}

      {/* ── Wall girts (hat channels): always rendered, tucked inside the panel
          ── skin so they read from the interior / through open walls only ── */}
      {show('girts') && (
        <Exploded id="girts">
          <WallGirts
            width={width} length={length} height={height} ridgeHeight={ridgeHeight}
            roofStyle={roofStyle} walls={walls} doors={doors}
            wallOrientation={(wallOrientation === 'auto' || !wallOrientation)
              ? (roofStyle === 'a_frame_vertical' ? 'vertical' : 'horizontal')
              : wallOrientation}
            spacing={structure.girtSpacing}
            hiddenParts={config.hiddenParts}
            hiddenInstances={hiddenInstances}
            square={squareSecondary}
          />
        </Exploded>
      )}

      {/* ── Cladding + trim: hidden in frame-only view ── */}
      {!frameOnly && (
        <>
          {show('roof') && (
            <Exploded id="roof">
              <BuildingRoof
                width={width} length={length} height={height}
                roofStyle={roofStyle} ridgeHeight={ridgeHeight}
                color={roofColor.hex}
                panelProfile={panelProfile}
                hiddenInstances={hiddenInstances}
              />
            </Exploded>
          )}
          {show('walls') && (
            <Exploded id="walls">
              <BuildingWalls
                width={width} length={length} height={height}
                walls={walls} doors={show('doors') ? doors : []}
                ridgeHeight={ridgeHeight} roofStyle={roofStyle}
                color={wallColor.hex}
                wainscotEnabled={wainscotEnabled && show('wainscot')}
                wainscotColor={wainscotColor}
                wainscotWalls={show('wainscot') ? wainscotWalls : {}}
                wallOrientation={wallOrientation}
                frameSpacing={structure.spacing}
                endPostSpacing={structure.endPostSpacing}
                panelProfile={panelProfile}
                hiddenInstances={hiddenInstances}
              />
            </Exploded>
          )}
          {(show('ridgeCap') || show('eaveTrim') || show('cornerTrim')) && (
            <Exploded id="eaveTrim">
              <TrimMesh
                width={width} length={length} height={height}
                roofStyle={roofStyle} ridgeHeight={ridgeHeight}
                color={trimColor.hex} roofColor={roofColor.hex}
                walls={walls} leanTos={leanTos} vis={vis}
                hiddenInstances={hiddenInstances}
              />
            </Exploded>
          )}

          {frontExtend > 0 && (
            <ExtendedGableCanopy
              width={width} halfLength={halfLength} height={height}
              roofPitch={roofPitch} extendFt={frontExtend} side="front"
              roofColor={roofColor.hex} trimColor={trimColor.hex}
            />
          )}
          {backExtend > 0 && (
            <ExtendedGableCanopy
              width={width} halfLength={halfLength} height={height}
              roofPitch={roofPitch} extendFt={backExtend} side="back"
              roofColor={roofColor.hex} trimColor={trimColor.hex}
            />
          )}
        </>
      )}

      {/* ── Skylights: translucent L5 strips on roof slopes + walls. Independent of
          the roof/walls visibility toggles; hidden only in frame-only view. ── */}
      {!frameOnly && show('skylights') && (() => {
        const isVert = (wallOrientation === 'auto' || !wallOrientation)
          ? (roofStyle === 'a_frame_vertical') : (wallOrientation === 'vertical')
        const bases = [
          ...getRoofSkylightBases({ width, length, height, ridgeHeight, roofStyle }),
          ...getWallSkylightBases({ width, length, height, walls, isVertical: isVert }),
        ]
        return bases.map(({ surfaceKey, basis }) => (
          <SkylightSurface key={surfaceKey} surfaceKey={surfaceKey} basis={basis} />
        ))
      })()}

      {/* ── Lean-to wings ── */}
      {show('leanTos') && ['left', 'right', 'front', 'back'].map((side) => {
        const lt = leanTos?.[side]
        if (!lt?.enabled) return null
        if (config.hiddenParts?.[`leanTos#${side}`]) return null   // individual wing hidden
        // Continuous roofline: lean-to carries the MAIN roof slope past the eave
        // as ONE unbroken plane. The main roof SKIN sits LIFT above the rafters,
        // so the lean-to roof must start at that skin level (eave + LIFT) and run
        // at the main pitch — otherwise there's a step down at the eave.
        const ROOF_LIFT = roofLift(width)   // matches BuildingRoof skin lift (>30′ rides higher)
        const continuous = lt.roofConnection === 'continuous'
        // Step-down: the lean-to roof must tie in at least 1′ BELOW the center
        // building's eave (leg height) so it reads as a separate, lower roofline.
        const ltAttach = continuous
          ? height + ROOF_LIFT
          : Math.min(lt.attachHeight ?? height, height - 1)
        const ltPitch  = continuous ? roofPitch : (lt.pitch ?? 2)
        return (
          <BuildingLeanTo
            key={side}
            mainWidth={width} mainHeight={height} length={length}
            side={side}
            leanWidth={lt.width}
            attachHeight={ltAttach}   // null → auto = main eave
            pitch={ltPitch}
            continuous={continuous}
            walls={lt.walls}
            frameOnly={frameOnly}
            roofColor={roofColor.hex} wallColor={wallColor.hex} trimColor={trimColor.hex}
            panelProfile={panelProfile}
            wallOrientation={wallOrientation} roofStyle={roofStyle}
            girtSpacing={structure.girtSpacing}
            frameSpacing={structure.spacing}
            squareSecondary={squareSecondary}
            showSkylights={show('skylights') && !frameOnly}
            wainscotEnabled={wainscotEnabled && show('wainscot')}
            wainscotColor={wainscotColor.hex}
            wainscotWalls={show('wainscot') ? wainscotWalls : {}}
            trimVis={{ eave: show('eaveTrim'), rake: show('rakeTrim'), corner: show('cornerTrim') }}
            hiddenInstances={hiddenInstances}
          />
        )
      })}

      {/* ── Interior partition walls (cross-section + lengthwise), snap to posts ── */}
      {show('interiorWalls') && (
        <BuildingInteriorWalls
          width={width} length={length} height={height} ridgeHeight={ridgeHeight}
          roofStyle={roofStyle} wallColor={wallColor.hex} panelProfile={panelProfile}
          structure={structure} frameOnly={frameOnly}
          anchorType={anchorType} showAnchors={showAnchors}
          hiddenInstances={hiddenInstances}
        />
      )}

      {/* ── Wrap-around hip corners: where two adjacent lean-tos meet AND the
            Wrap-Around Roof toggle is on, fill the corner with a hip roof + the
            outer corner walls so the roofline (and walls) wrap with no gap. ── */}
      {show('leanTos') && config.wrapAroundRoof && (() => {
        const resolveLean = (side) => {
          const lt = leanTos?.[side]
          if (!lt?.enabled) return null
          if (config.hiddenParts?.[`leanTos#${side}`]) return null
          const continuous = lt.roofConnection === 'continuous'
          const attachH = continuous ? height + roofLift(width) : Math.min(lt.attachHeight ?? height, height - 1)
          const pitch   = continuous ? roofPitch : (lt.pitch ?? 2)
          const leanH   = Math.max(6, attachH - lt.width * (pitch / 12))
          return { width: lt.width, attachH, leanH, outerClosed: lt.walls?.outer !== 'open' }
        }
        return [
          ['front-left', 'left', 'front'], ['front-right', 'right', 'front'],
          ['back-left', 'left', 'back'],   ['back-right', 'right', 'back'],
        ].map(([corner, sideKey, endKey]) => {
          const sideLean = resolveLean(sideKey)
          const endLean  = resolveLean(endKey)
          if (!sideLean || !endLean) return null
          return (
            <LeanToCorner
              key={corner} corner={corner}
              mainWidth={width} length={length}
              sideLean={sideLean} endLean={endLean}
              roofColor={roofColor.hex} wallColor={wallColor.hex} trimColor={trimColor.hex}
              panelProfile={panelProfile} frameOnly={frameOnly} isVertical
              trimVis={{ eave: show('eaveTrim'), rake: show('rakeTrim'), corner: show('cornerTrim') }}
              hiddenInstances={hiddenInstances}
            />
          )
        })
      })()}

      {/* ── Telehandler(s) catty-corner off the FRONT-LEFT corner — shown only when
            >30′ wide; a 2nd one when >40′ wide (matches telehandlerQty). Draggable. ── */}
      {!frameOnly && Array.from({ length: telehandlerQty }).map((_, i) => (
        <DraggableProp key={i} id={`telehandler-${i}`} label="Telehandler"
          defaultPos={[-width / 2 - 35 - i * 17, 0, -length / 2 - 35 + i * 13]} defaultRot={-Math.PI / 4}>
          <Telehandler />
        </DraggableProp>
      ))}

      {/* ── Loaded pickup + 30′ trailer parked near the telehandler. Draggable.
            A light-green 40′ access ring rings the building and turns red if the
            rig is dragged fully outside it (an extra labor charge then applies). ── */}
      {!frameOnly && (
        <>
          <DeliveryAccessRing width={width} length={length}
            defaultPos={deliveryDefaultPos} defaultRot={deliveryDefaultRot} />
          <DraggableProp id="delivery-0" label="Truck & Trailer"
            defaultPos={deliveryDefaultPos} defaultRot={deliveryDefaultRot}>
            <DeliveryRig wallColor={wallColor.hex} panelProfile={panelProfile} />
          </DraggableProp>
        </>
      )}

      {/* ── Scissor lift(s) staged BEHIND the telehandler + truck — shown only when
            >12′ tall; a 2nd one when >40′ wide (matches scissorQty). Draggable. ── */}
      {!frameOnly && Array.from({ length: scissorQty }).map((_, i) => (
        <DraggableProp key={i} id={`scissor-${i}`} label="Scissor Lift"
          defaultPos={[-width / 2 - 50 - i * 10, 0, -length / 2 - 58 - i * 6]} defaultRot={Math.PI * 0.62}>
          <ScissorLift />
        </DraggableProp>
      ))}
    </group>
    </PieceInspectProvider>
    </TubeWallContext.Provider>
  )
}
