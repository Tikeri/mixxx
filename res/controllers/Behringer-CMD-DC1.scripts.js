function BehringerCMDDC1 () {}
// Behringer CMD DC-1 Midi interface script for Mixxx Software
// Author  : Tiger <tiger@braineed.org> / Tiger #Mixxx@irc.freenode.net
// Version : 0.1.2

// Default channel of this device
// We substitute 1 because count starts from 0 (See MIDI specs)
BehringerCMDDC1.defch = 6-1;

BehringerCMDDC1.LEDCmd = 0x90; // Command Byte : Note On
BehringerCMDDC1.LEDOff = 0x00; // LEDs can't be turned off, the Off status is LEDs to Orange/Amber color
BehringerCMDDC1.LEDBlue = 0x01;
BehringerCMDDC1.LEDBlueBlink = 0x02;

BehringerCMDDC1.encLeft = 0x3F;
BehringerCMDDC1.encRight = 0x41;

BehringerCMDDC1.encLEDCmd = 0xB0; // Command Byte : Continuous Controller (CC)
BehringerCMDDC1.encLEDMid = 0x08;
BehringerCMDDC1.encLEDOff = 0x00;
BehringerCMDDC1.encLEDCnt = 16; // Ring of 15 LEDs -> 16 for round maths, special handling for max
BehringerCMDDC1.encLEDUnit = 1/BehringerCMDDC1.encLEDCnt;

BehringerCMDDC1.FXCtrlCnt = 4;
BehringerCMDDC1.FXCtrlStart = 0x14;

// Stores the physicals controls addresses with their affected effect parameters string
// Example : '[EffectRack1_EffectUnitX].super1': 0x14
BehringerCMDDC1.FXControls = {};

// Stores the physicals controls addresses with their affected special effects and parameters string
BehringerCMDDC1.SFXControls = {
    "0x10":"[Channel1].pitch_adjust",
    "0x11":"[QuickEffectRack1_[Channel1]].super1",
    "0x12":"[QuickEffectRack1_[Channel2]].super1",
    "0x13":"[Channel2].pitch_adjust"
};

// Decks count
BehringerCMDDC1.deckCnt = 4;

// Stores the active cue mode as string
BehringerCMDDC1.cueMode = undefined;

// Cue mode physical control addresses
BehringerCMDDC1.setCueCtrl = 0x14;
BehringerCMDDC1.gotoCueCtrl = 0x15;
BehringerCMDDC1.gotoNPlayCueCtrl = 0x16;
BehringerCMDDC1.clearCueCtrl = 0x17;

// Stores the status of the decks
BehringerCMDDC1.deckStatus = {};
// Decks physical controls addresses (used of LEDs initialization only)
BehringerCMDDC1.deckControls = [ 0x00 , 0x03 ];

// Physical controls related to cues buttons
BehringerCMDDC1.CUECnt = 16;
BehringerCMDDC1.CUESStartCtrl = 0x24;
BehringerCMDDC1.CUESStopCtrl = 0x33;

// Stores the physicals controls addresses to their related hotcue number
BehringerCMDDC1.CUESControls = {};


/*
 * Initialize decks LEDs
 */
BehringerCMDDC1.initDecksLEDs = function() {
    for(var i=0; i < BehringerCMDDC1.deckCnt; i++ ) {
        midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd, BehringerCMDDC1.deckControls[i], BehringerCMDDC1.LEDOff);
    }
};

/*
 * Initialize decks status for active mode
 */
BehringerCMDDC1.initDecksStatus = function() {
    for(var i=1; i <= BehringerCMDDC1.deckCnt; i++) {
        BehringerCMDDC1.deckStatus[i] = false;
    }
    BehringerCMDDC1.initDecksLEDs();
};

/*
 * Add/Set deck for cue mode
 */
BehringerCMDDC1.enableDeck = function(channel, control, value, status, group) {
    var deck = group.substring( (group.length - 2), (group.length - 1));
    
    BehringerCMDDC1.deckStatus[deck] ^= true;
    
    midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd,
                      control,
                      (BehringerCMDDC1.deckStatus[deck] == true ? BehringerCMDDC1.LEDBlueBlink : BehringerCMDDC1.LEDOff)
         );
};

/*
 * Affect the hotcues to their respective physical control addresses
 */
BehringerCMDDC1.initCUEControls = function() {
    var cuectrl = BehringerCMDDC1.CUESStartCtrl;
    
    for(var i=1; i <= BehringerCMDDC1.CUECnt; i++) {
        
        BehringerCMDDC1.CUESControls[cuectrl] = i;
        cuectrl++;
    }
};

/*
 * 
 */
BehringerCMDDC1.initCueMode = function() {
    midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd, BehringerCMDDC1.setCueCtrl, BehringerCMDDC1.LEDOff);
    midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd, BehringerCMDDC1.gotoCueCtrl, BehringerCMDDC1.LEDOff);
    midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd, BehringerCMDDC1.gotoNPlayCueCtrl, BehringerCMDDC1.LEDOff);
    midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd, BehringerCMDDC1.clearCueCtrl, BehringerCMDDC1.LEDOff);
    BehringerCMDDC1.cueMode = undefined;
};

/*
 * 
 */
BehringerCMDDC1.cueMode = function(channel, control, value, status, group) {
    
    BehringerCMDDC1.initCueMode();
    
    var cueModes = [ 'clear','set','goto','gotoandplay' ];
    
    switch(control) {
        case BehringerCMDDC1.setCueCtrl:
            BehringerCMDDC1.cueMode = cueModes[1];
            break;
        case BehringerCMDDC1.gotoCueCtrl:
            BehringerCMDDC1.cueMode = cueModes[2];
            break;
        case BehringerCMDDC1.gotoNPlayCueCtrl:
            BehringerCMDDC1.cueMode = cueModes[3];
            break;
        case BehringerCMDDC1.clearCueCtrl:
            BehringerCMDDC1.cueMode = cueModes[0];
            break;
        default:
            BehringerCMDDC1.cueMode = undefined;
            break;
    }
    
    if(BehringerCMDDC1.cueMode !== undefined) {
        midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd, control, BehringerCMDDC1.LEDBlueBlink);
    }
};

/*
 * Set/Clear/Goto/GotoAndPlay the cues on selected decks
 */
BehringerCMDDC1.setCues = function(channel, control, value, status, group) {
    if(BehringerCMDDC1.cueMode !== undefined) {
        var changrp="[Channel";
        var cuepref = "hotcue_";
        
        for(var i=1; i <= BehringerCMDDC1.deckCnt; i++) {
            if(BehringerCMDDC1.deckStatus[i] == true) {
                engine.setValue(changrp+i+"]", cuepref+BehringerCMDDC1.CUESControls[control]+"_"+BehringerCMDDC1.cueMode, value);
            }
        }
    }
};

/*
 * Turn to default color (orange) all LEDs and turn Off all encoders LEDs rings
 */
BehringerCMDDC1.initLEDs = function() {
    // Turn into orange all buttons LEDs
    for(var i=0x00; i <= 0x33; i++)
        midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.LEDCmd, i, BehringerCMDDC1.LEDOff);
    
    // Turn off all encoders ring of LEDs 
    for(var i=0x10; i <= 0x17; i++)
        midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.encLEDCmd, i, BehringerCMDDC1.encLEDOff);
};

/*
 * Encoders handle for effect parameters
 */
BehringerCMDDC1.encoderFXParam = function(channel, control, value, status, group) {
    // Get the parameter and its number
    var param = group.split(".");
    
    // Grab the current parameter value
    var fxreal = engine.getParameter(param[0], param[1]);
    
    // Increment the effect parameter value
    if(value == BehringerCMDDC1.encRight) {
        fxreal += (fxreal == 1 ? 0 : BehringerCMDDC1.encLEDUnit);
        engine.setParameter(param[0], param[1], fxreal);
    }
    
    // Decrement the effect parameter value
    if(value == BehringerCMDDC1.encLeft) {
        fxreal -= (fxreal == 0 ? 0 : BehringerCMDDC1.encLEDUnit);
        engine.setParameter(param[0], param[1], fxreal);
    }
};

/*
 * Convert an effect parameter value to the LED ring encoder scale
 */
BehringerCMDDC1.encoderParamLEDValue = function(group, param) {
    var val = script.absoluteLinInverse(engine.getParameter(group, param), 0, 1, 1, BehringerCMDDC1.encLEDCnt);
    if( val == BehringerCMDDC1.encLEDCnt ) {
        val--; // Truncate the max value
    }
    return val;
};

/*
 * Turn on any encoder LED for a given value
 * connectControled function
 */
BehringerCMDDC1.encoderFXLitLED = function(value, group, control) {
    // Bright the corresponding LED(s)
    midi.sendShortMsg(BehringerCMDDC1.defch | BehringerCMDDC1.encLEDCmd,
                        BehringerCMDDC1.FXControls[group+"."+control],
                        BehringerCMDDC1.encoderParamLEDValue(group, control)
                        );
};


/*
 * Initialize FX related variables and connectControl the effects parameters
 */
BehringerCMDDC1.connectFXEncoders = function() {
    var fxunit = 1;
    var fxctrl = BehringerCMDDC1.FXCtrlStart;
    
    var grpref = "[EffectRack1_EffectUnit";
    var grpara = "super1";
    
    for(var i=1; i <= BehringerCMDDC1.FXCtrlCnt; i++) {
        BehringerCMDDC1.FXControls[grpref+i+"]."+grpara] = fxctrl;
        engine.connectControl(grpref+i+"]", grpara, "BehringerCMDDC1.encoderFXLitLED");
        engine.trigger(grpref+i+"]", grpara);
        fxctrl++;
    }
};


/*
 * Initialize Special FX related variables and connectControl the effects parameters
 */
BehringerCMDDC1.connectSFXEncoders = function() {
    for(var sfxctrl in BehringerCMDDC1.SFXControls) {
        var sfxgrparam = BehringerCMDDC1.SFXControls[sfxctrl].split(".");
        // Add an entry and affect a physical control address to the parameter string
        // A virtual line is added with same control for compatibility with encoderFXLitLED()
        BehringerCMDDC1.FXControls[BehringerCMDDC1.SFXControls[sfxctrl]] = sfxctrl;
        
        engine.connectControl(sfxgrparam[0], sfxgrparam[1], "BehringerCMDDC1.encoderFXLitLED");
        // Init LEDs of SFX Encoders
        engine.trigger(sfxgrparam[0], sfxgrparam[1]);
    }
};


/*** Constructor ***/
BehringerCMDDC1.init = function() {
    BehringerCMDDC1.initLEDs();
    BehringerCMDDC1.connectFXEncoders();
    BehringerCMDDC1.connectSFXEncoders();
    BehringerCMDDC1.initDecksStatus();
    BehringerCMDDC1.initCUEControls();
};

/*** Destructor ***/
BehringerCMDDC1.shutdown = function() {
    BehringerCMDDC1.initLEDs();
};
