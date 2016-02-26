function BehringerCMDDV1 () {}
// Behringer CMD DV-1 Midi interface script for Mixxx Software
// Author  : Tiger <tiger@braineed.org> / Tiger #Mixxx@irc.freenode.net
// Version : 0.1.4

// Default channel of this device
// We substitute 1 because count starts from 0 (See MIDI specs)
BehringerCMDDV1.defch = 7-1;

BehringerCMDDV1.LEDCmd = 0x90; // Command Byte : Note On
BehringerCMDDV1.LEDOff = 0x00; // LEDs can't be turned off, the Off status is LEDs to Orange/Amber color
BehringerCMDDV1.LEDBlue = 0x01;
BehringerCMDDV1.LEDBlueBlink = 0x02;

BehringerCMDDV1.encLeft = 0x3F;
BehringerCMDDV1.encRight = 0x41;

BehringerCMDDV1.encLEDCmd = 0xB0; // Command Byte : Continuous Controller (CC)
BehringerCMDDV1.encLEDMid = 0x08;
BehringerCMDDV1.encLEDOff = 0x00;
BehringerCMDDV1.encLEDCnt = 16; // Ring of 15 LEDs -> 16 for round maths, special handling for max
BehringerCMDDV1.encLEDUnit = 1/BehringerCMDDV1.encLEDCnt;

// Number of effects
BehringerCMDDV1.FXChainCnt = 5;

// Controls container for the effect chain selected
// Encoders used for effect selection ( 2 physical * 4 virtual )
BehringerCMDDV1.FXChainSel = {};
BehringerCMDDV1.FXChainCtrlStart = 0x14;
BehringerCMDDV1.FXChainCtrlCnt = 8;

// Stores the physicals controls addresses with their affected effect parameters string
// Example : 'RawX[EffectRack1_EffectUnitX_Effect1].parameterX': 0x15
BehringerCMDDV1.FXControls = {};
BehringerCMDDV1.FXChainRawCnt = 2; // 2 Physical raw of effects
BehringerCMDDV1.FXChainRawPrefix = "Raw"; // Raw prefix string to insert into group string

// Stores the physicals controls addresses with their affected special effects and parameters string
BehringerCMDDV1.SFXControls = {
    "0x40":"[Channel1].pitch_adjust",
    "0x41":"[QuickEffectRack1_[Channel1]].super1",
    "0x42":"[QuickEffectRack1_[Channel2]].super1",
    "0x43":"[Channel2].pitch_adjust"
};

// Decks count
BehringerCMDDV1.deckCnt = 4;

// Physicals mode control start and end addresses
BehringerCMDDV1.modeStartCtrl = 0x40;
BehringerCMDDV1.modeEndCtrl = 0x4C;

// Physicals different modes start addresses used for comparison 
BehringerCMDDV1.FocusStartCtrl = 0x40;
BehringerCMDDV1.MasterStartCtrl = 0x44;
BehringerCMDDV1.DoubleStartCtrl = 0x48;

// Stores the status of the modes
BehringerCMDDV1.modeStatus = {
    "Focus": false,
    "Master": false,
    "Double": false
};

// As there's no control to know the current mode selection, we need to store the last one
BehringerCMDDV1.lastMode = "none";

// Stores the status of the erase button
BehringerCMDDV1.eraseStatus = false;
BehringerCMDDV1.eraseCtrl = 0x55;

// Stores the status of the decks
BehringerCMDDV1.deckStatus = {};

// First and last physical addresses of the BeatRollLoop controls
BehringerCMDDV1.BeatRollLoopStartCtrl = 0x50;
BehringerCMDDV1.BeatRollLoopStopCtrl = 0x53;

// Stores the physicals controls addresses of BeatRollLoop and their affected values
BehringerCMDDV1.BeatRollLoopDownCtrls = {};
BehringerCMDDV1.BeatRollLoopUpCtrls = {};

// Physical controls count of cues buttons
BehringerCMDDV1.CUECnt = 8;

// Stores the physicals controls addresses to their related hotcue number
BehringerCMDDV1.CUESControls = {};

// Stores the physicals controls to their corresponding Modes and Decks
// For futur use with connectControl
BehringerCMDDV1.deckCtrlsByModes = {};


/*
 * Initialize the object that will be used to store effect selection
 */
BehringerCMDDV1.initFXChains = function() {
    var startctrl = BehringerCMDDV1.FXChainCtrlStart;
    
    for(var i=0; i < BehringerCMDDV1.FXChainCtrlCnt; i++) {
        BehringerCMDDV1.FXChainSel[startctrl] = false;
        midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.LEDCmd, startctrl, BehringerCMDDV1.LEDBlueBlink);
        startctrl += 4; // 4 encoders per effect
    }
};

/*
 * Affect each pysical control to its corresponding Mode and Deck
 * For futur use with connectControl
 */
BehringerCMDDV1.initDeckModesCtrls = function(onlyMode) {
    var startctrl = BehringerCMDDV1.modeStartCtrl;
    
    for(var mode in (onlyMode !== undefined ? onlyMode : BehringerCMDDV1.modeStatus) ) {
        BehringerCMDDV1.deckCtrlsByModes[mode] = {};
        
        for(var i=1; i <= BehringerCMDDV1.deckCnt; i++) {
            BehringerCMDDV1.deckCtrlsByModes[mode][i]= startctrl;
            startctrl++;
        }
    }
};

/*
 * Initialize decks LEDs
 */
BehringerCMDDV1.initDecksLEDs = function() {
    for(var i=BehringerCMDDV1.FocusStartCtrl; i <= (BehringerCMDDV1.DoubleStartCtrl+4); i++) {
        midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.LEDCmd, i, BehringerCMDDV1.LEDOff);
    }
};

/*
 * Initialize decks status
 */
BehringerCMDDV1.initDecksStatus = function() {
    for(var i=1; i <= BehringerCMDDV1.deckCnt; i++) {
        BehringerCMDDV1.deckStatus[i] = false;
    }
    BehringerCMDDV1.initDecksLEDs();
};

/*
 * Affect Beat ratios to the physical controls addresses
 */
BehringerCMDDV1.initBeatRollLoopControls = function() {
    var ratio = 1;
    
    for(var i=BehringerCMDDV1.BeatRollLoopStartCtrl; i <= BehringerCMDDV1.BeatRollLoopStopCtrl; i++) {
        BehringerCMDDV1.BeatRollLoopUpCtrls[i] = ratio;
        // Starting from 1 beat, we cannot have same max mirror positive beat
        // for the same number of buttons so the 2 is skipped.
        ratio *= (ratio == 1 ? 4 : 2);
    }
    
    ratio = 1/2;
    
    for(var i=BehringerCMDDV1.BeatRollLoopStopCtrl; i >= BehringerCMDDV1.BeatRollLoopStartCtrl; i--) {
        BehringerCMDDV1.BeatRollLoopDownCtrls[i] = ratio;
        ratio /= 2;
    }
};

/*
 * Affect the hotcues to their respective physical control addresses
 */
BehringerCMDDV1.initCUEControls = function() {
    var cuectrl = 0x5C; // 1 to 4
    var switchmid = 0x58; // 5 to 8
    
    for(var i=1; i <= BehringerCMDDV1.CUECnt; i++) {
        if(i == (BehringerCMDDV1.CUECnt/2 + 1) ) {
            cuectrl = switchmid;
        }
        BehringerCMDDV1.CUESControls[cuectrl] = i;
        cuectrl++;
    }
};

/*
 * Reset/Clear all or one mode status if 'onlyMode' is provided
 */
BehringerCMDDV1.clearModes = function(onlyMode) {
    for(var mode in (onlyMode !== undefined ? onlyMode : BehringerCMDDV1.modeStatus) ) {
        BehringerCMDDV1.modeStatus[mode] = false;
    }
};

/*
 * Return the active Mode as a string
 */
BehringerCMDDV1.getEnabledMode = function() {
    for(var mode in BehringerCMDDV1.modeStatus) {
        if(BehringerCMDDV1.modeStatus[mode] == true) {
            return mode;
        }
    }
};

/*
 * Set the new active Mode
 */
BehringerCMDDV1.switchMode = function(control) {
    var checkMode = "none";
    
    if(control < BehringerCMDDV1.MasterStartCtrl) {
        checkMode = "Focus";
    } else if(control < BehringerCMDDV1.DoubleStartCtrl) {
        checkMode = "Master";
    } else {
        checkMode = "Double";
    }
    
    if(BehringerCMDDV1.lastMode != checkMode) {
        BehringerCMDDV1.lastMode = checkMode;
        BehringerCMDDV1.clearModes();
        BehringerCMDDV1.initDecksStatus();
        BehringerCMDDV1.modeStatus[checkMode] = true;
    }
};

/*
 * Toggles the erase mode
 */
BehringerCMDDV1.toggleEraser = function() {
    BehringerCMDDV1.eraseStatus ^= true;
    midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.LEDCmd,
                      BehringerCMDDV1.eraseCtrl,
                      (BehringerCMDDV1.eraseStatus == true ? BehringerCMDDV1.LEDBlueBlink : BehringerCMDDV1.LEDOff)
         );
};

/*
 * Set the active deck for the active mode
 */
BehringerCMDDV1.enableDeck = function(channel, control, value, status, group) {
    var deck = group.substring( (group.length - 2), (group.length - 1));
    
    BehringerCMDDV1.switchMode(control);
    BehringerCMDDV1.deckStatus[deck] ^= true;
    
    midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.LEDCmd,
                      control,
                      (BehringerCMDDV1.deckStatus[deck] == true ? BehringerCMDDV1.LEDBlueBlink : BehringerCMDDV1.LEDOff)
         );
};

/*
 * Beat Loop Rolls handle
 */
BehringerCMDDV1.setBeatModes = function(channel, control, value, status, group) {
    if(BehringerCMDDV1.getEnabledMode() !== undefined) {
        var changrp="[Channel";
        var ctrlpref = "beatlooproll_";
        var ctrlsuf = "_activate";
        
        for(var i=1; i <= BehringerCMDDV1.deckCnt; i++) {
            if(BehringerCMDDV1.modeStatus["Master"] == true && BehringerCMDDV1.deckStatus[i] == true) {
                engine.setValue(changrp+i+"]", ctrlpref+BehringerCMDDV1.BeatRollLoopDownCtrls[control]+ctrlsuf, value);
            }
            if(BehringerCMDDV1.modeStatus["Double"] == true && BehringerCMDDV1.deckStatus[i] == true) {
                engine.setValue(changrp+i+"]", ctrlpref+BehringerCMDDV1.BeatRollLoopUpCtrls[control]+ctrlsuf, value);
            }
        }
    }
};

/*
 * Clear/Set/Goto/GotoAndPlay the cues on selected decks
 */
BehringerCMDDV1.setCues = function(channel, control, value, status, group) {
    if(BehringerCMDDV1.getEnabledMode() !== undefined) {
        var changrp="[Channel";
        var cuepref = "hotcue_";
        var cuesuf = [ 'clear','set','goto','gotoandplay' ];
        
        for(var i=1; i <= BehringerCMDDV1.deckCnt; i++) {
            if(BehringerCMDDV1.eraseStatus == true && BehringerCMDDV1.deckStatus[i] == true) {
                engine.setValue(changrp+i+"]", cuepref+BehringerCMDDV1.CUESControls[control]+"_"+cuesuf[0], value);
            } else {
                if(BehringerCMDDV1.modeStatus["Focus"] == true && BehringerCMDDV1.deckStatus[i] == true) {
                    // FIXME : value always points to 127, you can also set multiple times same hotcue
                    // Affected version : <= 2.0.0
                    engine.setValue(changrp+i+"]", cuepref+BehringerCMDDV1.CUESControls[control]+"_"+cuesuf[1], value);
                }
                if(BehringerCMDDV1.modeStatus["Master"] == true && BehringerCMDDV1.deckStatus[i] == true) {
                    engine.setValue(changrp+i+"]", cuepref+BehringerCMDDV1.CUESControls[control]+"_"+cuesuf[2], value);
                }
                if(BehringerCMDDV1.modeStatus["Double"] == true && BehringerCMDDV1.deckStatus[i] == true) {
                    engine.setValue(changrp+i+"]", cuepref+BehringerCMDDV1.CUESControls[control]+"_"+cuesuf[3], value);
                }
            }
        }
        if(BehringerCMDDV1.eraseStatus == true) {
            BehringerCMDDV1.toggleEraser();
        }
    }
};

/*
 * Select and assign effect to LEDs
 * connectControled function
 */
BehringerCMDDV1.encoderFXSelLitLED = function(value, group, control) {
    // Turn LED on for the selected effect
    for(var i=1; i <= BehringerCMDDV1.FXChainRawCnt; i++)
    {
        var selCtrl = BehringerCMDDV1.FXControls[BehringerCMDDV1.FXChainRawPrefix+i+group+"."+control];
        midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.encLEDCmd, selCtrl, BehringerCMDDV1.FXChainSel[selCtrl]);
    }
};

/*
 * Encoders handle for effect selectors
 */
BehringerCMDDV1.encoderFXSelect = function(channel, control, value, status, group) { 
    // Select previous effect
    if(value == BehringerCMDDV1.encLeft) {
        engine.setValue(group, "prev_chain", 0x3F);
        if(BehringerCMDDV1.FXChainSel[control] <= 1) {
            BehringerCMDDV1.FXChainSel[control] = BehringerCMDDV1.FXChainCnt;
        } else {
            BehringerCMDDV1.FXChainSel[control]--;
        }
    }
    
    // Select next effect
    if(value == BehringerCMDDV1.encRight) {
        engine.setValue(group, "next_chain", 0x41);
        if(BehringerCMDDV1.FXChainSel[control] == BehringerCMDDV1.FXChainCnt) {
            BehringerCMDDV1.FXChainSel[control] = 1;
        } else {
            BehringerCMDDV1.FXChainSel[control]++;
        }
    }
    
    // We have to update the two raw as they control the same things
    var nextRawCtrl = BehringerCMDDV1.FXChainCtrlStart + (BehringerCMDDV1.FXChainCtrlCnt * BehringerCMDDV1.FXChainRawCnt);
    // Refresh selection value for the other effect physical raw
    BehringerCMDDV1.FXChainSel[(control < nextRawCtrl ? control+16 : control-16)] = BehringerCMDDV1.FXChainSel[control];
    
    // Update effect enabled LEDs
    midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.LEDCmd,
                      control,
                      (engine.getParameter(group, "enabled") == true ? BehringerCMDDV1.LEDBlue : 0x00)
         );
    midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.LEDCmd,
                      (control < nextRawCtrl ? control+16 : control-16),
                      (engine.getParameter(group, "enabled") == true ? BehringerCMDDV1.LEDBlue : 0x00)
         );
};

/*
 * Encoders handle for effect parameters
 */
BehringerCMDDV1.encoderFXParam = function(channel, control, value, status, group) {
    // Get the parameter and its number
    var param = group.split(".");
    
    // Grab the current parameter value
    var fxreal = engine.getParameter(param[0], param[1]);
    
    // Increment the effect parameter value
    if(value == BehringerCMDDV1.encRight) {
        fxreal += (fxreal == 1 ? 0 : BehringerCMDDV1.encLEDUnit);
        engine.setParameter(param[0], param[1], fxreal);
    }
    
    // Decrement the effect parameter value
    if(value == BehringerCMDDV1.encLeft) {
        fxreal -= (fxreal == 0 ? 0 : BehringerCMDDV1.encLEDUnit);
        engine.setParameter(param[0], param[1], fxreal);
    }
};

/*
 * Convert an effect parameter value to the LED ring encoder scale
 */
BehringerCMDDV1.encoderParamLEDValue = function(group, param) {
    var val = script.absoluteLinInverse(engine.getParameter(group, param), 0, 1, 1, BehringerCMDDV1.encLEDCnt);
    if( val == BehringerCMDDV1.encLEDCnt ) {
        val--; // Truncate the max value
    }
    return val;
};

/*
 * Turn on any encoder LED for a given value
 * connectControled function
 */
BehringerCMDDV1.encoderFXLitLED = function(value, group, control) {
    // Bright the corresponding LED(s)
    for(var i=1; i <= BehringerCMDDV1.FXChainRawCnt; i++) {
        midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.encLEDCmd,
                          BehringerCMDDV1.FXControls[BehringerCMDDV1.FXChainRawPrefix+i+group+"."+control],
                          BehringerCMDDV1.encoderParamLEDValue(group, control)
                         );
    }
};

/*
 * Initialize FX related variables and connectControl the effects parameters and selection
 */
BehringerCMDDV1.connectFXEncoders = function() {
    var fxraw = 1; // We start from raw 1 ...
    var fxunit = 1; // ... and from effect unit 1
    
    // This stay here in case of software modifications, will be easier to do changes
    var grpref = "[EffectRack1_EffectUnit";
    var grchains = [ "prev_chain", "next_chain" ];
    var grpsuf = "_Effect1]";
    var grpara = "parameter";
    
    for(var fxctrl in BehringerCMDDV1.FXChainSel) {
        if( fxunit > 4 ) {
            fxraw++; // Next control raw of effects
            fxunit = 1; // Reset effect unit counter
        }
        
        // Connect chains selectors
        for(var i=0; i < 2; i++) {
            // Add an entry and affect a physical control address to the effect chain selectors strings
            BehringerCMDDV1.FXControls[BehringerCMDDV1.FXChainRawPrefix+fxraw+grpref+fxunit+"]."+grchains[i]] = fxctrl;
            engine.connectControl(grpref+fxunit+"]", grchains[i], "BehringerCMDDV1.encoderFXSelLitLED");
        }
        
        // Connect effect parameters
        for(var i=1; i <= 3; i++) {
            fxctrl++; // First parameter starts on next control per row
            
            var fxgrp = grpref+fxunit+grpsuf;
            var fxpar = grpara+i;
            
            // Add an entry and affect a physical control address to the parameter string
            BehringerCMDDV1.FXControls[BehringerCMDDV1.FXChainRawPrefix+fxraw+fxgrp+"."+fxpar] = fxctrl;     

            if(fxraw == 1) {
                engine.connectControl(fxgrp, fxpar, "BehringerCMDDV1.encoderFXLitLED");
                // FIXME: If we don't trigger it, this will generate an error with the parameter1
                // of the first selected effect (Not called dunno why..?)
                engine.trigger(fxgrp, fxpar);
            }
        }
        
        fxunit++; // Next effect unit
    }
};


/*
 * Initialize Special FX related variables and connectControl the effects parameters
 */
BehringerCMDDV1.connectSFXEncoders = function() {
    for(var sfxctrl in BehringerCMDDV1.SFXControls) {
        var sfxgrparam = BehringerCMDDV1.SFXControls[sfxctrl].split(".");
        // Add an entry and affect a physical control address to the parameter string
        // A virtual line is added with same control for compatibility with encoderFXLitLED()
        for(var i=1; i <= BehringerCMDDV1.FXChainRawCnt; i++) {
            BehringerCMDDV1.FXControls[BehringerCMDDV1.FXChainRawPrefix+i+BehringerCMDDV1.SFXControls[sfxctrl]] = sfxctrl;
        }
        engine.connectControl(sfxgrparam[0], sfxgrparam[1], "BehringerCMDDV1.encoderFXLitLED");
        // Init LEDs of SFX Encoders
        engine.trigger(sfxgrparam[0], sfxgrparam[1]);
    }
};

/*
 * Turn to the defined off color all LEDs and turn off all encoders rings of LEDs
 */
BehringerCMDDV1.initLEDs = function() {
    // Buttons LEDs
    for(var i=0x14; i <= 0x5F; i++)
        midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.LEDCmd, i, BehringerCMDDV1.LEDOff);
    
    // Encoders LEDs
    for(var i=0x14; i <= 0x43; i++)
        midi.sendShortMsg(BehringerCMDDV1.defch | BehringerCMDDV1.encLEDCmd, i, BehringerCMDDV1.encLEDOff);
};

/*** Constructor ***/
BehringerCMDDV1.init = function() {
    BehringerCMDDV1.initLEDs();
    BehringerCMDDV1.initFXChains();
    BehringerCMDDV1.connectFXEncoders();
    BehringerCMDDV1.connectSFXEncoders();
    //BehringerCMDDV1.initDeckModesCtrls();
    BehringerCMDDV1.initBeatRollLoopControls();
    BehringerCMDDV1.initCUEControls();
};

/*** Destructor ***/
BehringerCMDDV1.shutdown = function() {
    BehringerCMDDV1.initLEDs();
};
