/**
 * @module firmware/px4-params
 * @description PX4 parameter name mapping (canonical ArduPilot -> PX4).
 */

// ---------------------------------------------------------------------------
// PX4 parameter name mapping (canonical ArduPilot -> PX4)
// ---------------------------------------------------------------------------

export const PX4_PARAM_MAP: Record<string, string> = {
  // ── PID rate (inner loop) ─────────────────────────────
  ATC_RAT_RLL_P: 'MC_ROLLRATE_P',
  ATC_RAT_RLL_I: 'MC_ROLLRATE_I',
  ATC_RAT_RLL_D: 'MC_ROLLRATE_D',
  ATC_RAT_RLL_FF: 'MC_ROLLRATE_FF',
  ATC_RAT_PIT_P: 'MC_PITCHRATE_P',
  ATC_RAT_PIT_I: 'MC_PITCHRATE_I',
  ATC_RAT_PIT_D: 'MC_PITCHRATE_D',
  ATC_RAT_PIT_FF: 'MC_PITCHRATE_FF',
  ATC_RAT_YAW_P: 'MC_YAWRATE_P',
  ATC_RAT_YAW_I: 'MC_YAWRATE_I',
  ATC_RAT_YAW_D: 'MC_YAWRATE_D',
  ATC_RAT_YAW_FF: 'MC_YAWRATE_FF',

  // ── PID angle (outer loop) ────────────────────────────
  ATC_ANG_RLL_P: 'MC_ROLL_P',
  ATC_ANG_PIT_P: 'MC_PITCH_P',
  ATC_ANG_YAW_P: 'MC_YAW_P',

  // ── Receiver channel mapping ──────────────────────────
  RCMAP_ROLL: 'RC_MAP_ROLL',
  RCMAP_PITCH: 'RC_MAP_PITCH',
  RCMAP_YAW: 'RC_MAP_YAW',
  RCMAP_THROTTLE: 'RC_MAP_THROTTLE',

  // ── Flight modes ──────────────────────────────────────
  FLTMODE_CH: 'RC_MAP_FLTMODE',
  FLTMODE1: 'COM_FLTMODE1',
  FLTMODE2: 'COM_FLTMODE2',
  FLTMODE3: 'COM_FLTMODE3',
  FLTMODE4: 'COM_FLTMODE4',
  FLTMODE5: 'COM_FLTMODE5',
  FLTMODE6: 'COM_FLTMODE6',

  // ── Power / battery ───────────────────────────────────
  BATT_MONITOR: 'BAT1_SOURCE',
  BATT_CAPACITY: 'BAT1_CAPACITY',
  BATT_VOLT_MULT: 'BAT1_V_DIV',
  BATT_AMP_PERVLT: 'BAT1_A_PER_V',
  BATT_AMP_OFFSET: 'BAT1_A_OFFSET',
  BATT2_MONITOR: 'BAT2_SOURCE',
  BATT2_CAPACITY: 'BAT2_CAPACITY',
  BATT2_VOLT_MULT: 'BAT2_V_DIV',
  BATT2_AMP_PERVLT: 'BAT2_A_PER_V',
  BATT2_AMP_OFFSET: 'BAT2_A_OFFSET',

  // ── Failsafe ──────────────────────────────────────────
  FS_THR_ENABLE: 'COM_RC_LOSS_T',
  FS_THR_VALUE: 'RC_FAILS_THR',
  FS_GCS_ENABLE: 'COM_DL_LOSS_T',
  BATT_FS_LOW_ACT: 'COM_LOW_BAT_ACT',
  BATT_FS_LOW_VOLT: 'BAT_LOW_THR',
  BATT_FS_CRT_VOLT: 'BAT_CRIT_THR',

  // ── Geofence ──────────────────────────────────────────
  FENCE_ENABLE: 'GF_ACTION',
  FENCE_ALT_MAX: 'GF_MAX_VER_DIST',
  FENCE_RADIUS: 'GF_MAX_HOR_DIST',

  // ── Compass calibration offsets ───────────────────────
  COMPASS_OFS_X: 'CAL_MAG0_XOFF',
  COMPASS_OFS_Y: 'CAL_MAG0_YOFF',
  COMPASS_OFS_Z: 'CAL_MAG0_ZOFF',
  COMPASS_OFS2_X: 'CAL_MAG1_XOFF',
  COMPASS_OFS2_Y: 'CAL_MAG1_YOFF',
  COMPASS_OFS2_Z: 'CAL_MAG1_ZOFF',

  // ── Altitude / position ───────────────────────────────
  WPNAV_SPEED: 'MPC_XY_VEL_MAX',
  WPNAV_SPEED_UP: 'MPC_Z_VEL_MAX_UP',
  WPNAV_SPEED_DN: 'MPC_Z_VEL_MAX_DN',
  WPNAV_ACCEL: 'MPC_ACC_HOR',
  PILOT_ACCEL_Z: 'MPC_ACC_UP_MAX',

  // ── General config ────────────────────────────────────
  ARMING_CHECK: 'COM_ARM_CHK_MODE',
  ARMING_REQUIRE: 'COM_ARM_AUTH_REQ',
  LAND_SPEED: 'MPC_LAND_SPEED',
  RTL_ALT: 'RTL_RETURN_ALT',

  // ── PX4-only PID gain multipliers (passthrough) ──
  MC_ROLLRATE_K: 'MC_ROLLRATE_K',
  MC_PITCHRATE_K: 'MC_PITCHRATE_K',
  MC_YAWRATE_K: 'MC_YAWRATE_K',

  // ── PX4 battery extras ─────────────────────────────────────
  BAT1_N_CELLS: 'BAT1_N_CELLS',
  BAT1_R_INTERNAL: 'BAT1_R_INTERNAL',

  // ── Sensors / rangefinder ─────
  SENS_EN_MB12XX: 'SENS_EN_MB12XX',
  SENS_EN_LL40LS: 'SENS_EN_LL40LS',
  SENS_EN_SF1XX: 'SENS_EN_SF1XX',
  EKF2_RNG_AID: 'EKF2_RNG_AID',
  EKF2_RNG_A_HMAX: 'EKF2_RNG_A_HMAX',
  EKF2_RNG_NOISE: 'EKF2_RNG_NOISE',
  EKF2_RNG_SFE: 'EKF2_RNG_SFE',
  EKF2_MIN_RNG: 'EKF2_MIN_RNG',

  // ── External vision (EV) — PX4-only, passthrough ──
  EKF2_EV_CTRL: 'EKF2_EV_CTRL',
  EKF2_EV_DELAY: 'EKF2_EV_DELAY',
  EKF2_EV_GATE: 'EKF2_EV_GATE',
  EKF2_EV_NOISE_MD: 'EKF2_EV_NOISE_MD',
  EKF2_EV_POS_X: 'EKF2_EV_POS_X',
  EKF2_EV_POS_Y: 'EKF2_EV_POS_Y',
  EKF2_EV_POS_Z: 'EKF2_EV_POS_Z',
  EKF2_EV_QMIN: 'EKF2_EV_QMIN',
  EKF2_EVP_NOISE: 'EKF2_EVP_NOISE',
  EKF2_EVV_NOISE: 'EKF2_EVV_NOISE',
  EKF2_EVA_NOISE: 'EKF2_EVA_NOISE',

  // ── Optical flow (OF) — PX4-only, passthrough ──
  EKF2_OF_CTRL: 'EKF2_OF_CTRL',
  EKF2_OF_DELAY: 'EKF2_OF_DELAY',
  EKF2_OF_GATE: 'EKF2_OF_GATE',
  EKF2_OF_N_MAX: 'EKF2_OF_N_MAX',
  EKF2_OF_N_MIN: 'EKF2_OF_N_MIN',
  EKF2_OF_POS_X: 'EKF2_OF_POS_X',
  EKF2_OF_POS_Y: 'EKF2_OF_POS_Y',
  EKF2_OF_POS_Z: 'EKF2_OF_POS_Z',
  EKF2_OF_QMIN: 'EKF2_OF_QMIN',
  EKF2_OF_GYR_SRC: 'EKF2_OF_GYR_SRC',

  // ── EKF2 top-level — PX4-only, passthrough ──
  EKF2_HGT_REF: 'EKF2_HGT_REF',
  EKF2_AID_MASK: 'EKF2_AID_MASK',
  SENS_FLOW_MAXR: 'SENS_FLOW_MAXR',

  // ── Gimbal ───────────────────────────────
  MNT1_TYPE: 'MNT_MODE_IN',
  MNT1_RC_IN_TILT: 'MNT_MAN_PITCH',
  MNT1_RC_IN_ROLL: 'MNT_MAN_ROLL',
  MNT1_RC_IN_PAN: 'MNT_MAN_YAW',
  MNT1_RC_RATE: 'MNT_RATE_PITCH',

  // ── Camera ─────────────────────────────
  CAM1_TYPE: 'TRIG_MODE',
  CAM1_DURATION: 'TRIG_ACT_TIME',
  CAM1_TRIGG_DIST: 'TRIG_DIST',
  CAM1_SERVO_ON: 'TRIG_PWM_SHOOT',

  // ── EKF failsafe (PX4-only, passthrough) ────────────────────
  COM_POS_FS_DELAY: 'COM_POS_FS_DELAY',
  COM_POS_FS_EPH: 'COM_POS_FS_EPH',
  COM_POS_FS_EPV: 'COM_POS_FS_EPV',
  COM_VEL_FS_EVH: 'COM_VEL_FS_EVH',

  // ── Geofence extras ─────────────────────────────────────────
  GF_ALTMODE: 'GF_ALTMODE',
  GF_SOURCE: 'GF_SOURCE',

  // ── Serial ports ────────────────────────────────
  SER_TEL1_BAUD: 'SER_TEL1_BAUD',
  SER_TEL2_BAUD: 'SER_TEL2_BAUD',
  SER_TEL3_BAUD: 'SER_TEL3_BAUD',
  SER_GPS1_BAUD: 'SER_GPS1_BAUD',

  // ── Airframe / actuator (PX4-only) ─────────────────────────
  SYS_AUTOSTART: 'SYS_AUTOSTART',
  SYS_AUTOCONFIG: 'SYS_AUTOCONFIG',
  CA_ROTOR_COUNT: 'CA_ROTOR_COUNT',
}

export const PX4_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PX4_PARAM_MAP).map(([k, v]) => [v, k])
)
