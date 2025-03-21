import inatjs from "inaturalistjs";
import _ from "lodash";
import {
  addIdentification,
  fetchCurrentObservation,
  fetchObservation,
  loadingDiscussionItem,
  stopLoadingDiscussionItem,
  updateCurrentObservation
} from "./current_observation_actions";
import { fetchObservationsStats } from "./observations_stats_actions";
import { updateObservationInCollection } from "./observations_actions";
import { showAlert } from "../../../shared/ducks/alert_modal";
import { showDisagreementAlert } from "../../shared/ducks/disagreement_alert";
import { updateSession } from "../../show/ducks/users";
import { setConfig } from "../../../shared/ducks/config";
import { parseRailsErrorsResponse, isDisagreement } from "../../../shared/util";
import { updateEditorContent } from "../../shared/ducks/text_editors";

const POST_IDENTIFICATION = "post_identification";
const AGREEING_WITH_OBSERVATION = "agreeing_with_observation";
const STOP_AGREEING_WITH_OBSERVATION = "stop_agreeing_with_observation";

function postIdentification( params ) {
  return function ( dispatch ) {
    const body = { identification: { ...params } };
    if ( body.identification.observation ) {
      body.identification.observation_id = body.identification.observation_id
        || body.identification.observation.id;
      delete body.identification.observation;
    }
    if ( body.identification.taxon ) {
      body.identification.taxon_id = body.identification.taxon_id || body.identification.taxon.id;
      delete body.identification.taxon;
    }
    return inatjs.identifications.create( body ).catch( e => {
      e.response.text( ).then( text => {
        const railsErrors = parseRailsErrorsResponse( text ) || [I18n.t( "failed_to_save_record" )];
        dispatch( showAlert(
          railsErrors.join( "," ),
          { title: I18n.t( "request_failed" ) }
        ) );
      } ).catch( ( ) => {
        dispatch( showAlert(
          I18n.t( "failed_to_save_record" ),
          { title: I18n.t( "request_failed" ) }
        ) );
      } );
      throw e;
    } );
  };
}

function updateIdentification( ident, updates ) {
  return function ( ) {
    return inatjs.identifications.update( ident, updates );
  };
}

function agreeWithObservaiton( observation ) {
  return ( dispatch, getState ) => {
    const s = getState( );
    dispatch( loadingDiscussionItem( ) );
    dispatch( updateObservationInCollection( observation, { agreeLoading: true } ) );
    return dispatch(
      postIdentification( {
        observation_id: s.config.testingApiV2 ? observation.uuid : observation.id,
        taxon_id: observation.taxon.id
      } )
    ).then( ( ) => {
      const observations = s.observations.results || [];
      if ( _.find( observations, o => o.uuid === observation.uuid || o.id === observation.id ) ) {
        dispatch( updateObservationInCollection( observation, { agreeLoading: false } ) );
        dispatch( fetchObservation( observation ) );
      }
    } );
  };
}

function agreeingWithObservation( ) {
  return { type: AGREEING_WITH_OBSERVATION };
}

function stopAgreeingWithObservation( ) {
  return { type: STOP_AGREEING_WITH_OBSERVATION };
}

function agreeWithCurrentObservation( ) {
  return function ( dispatch, getState ) {
    const s = getState( );
    if ( s.config.blind ) {
      return null;
    }
    if ( s.currentObservation.tab !== "info" ) {
      return null;
    }
    const currentObservation = s.currentObservation.observation;
    const { currentUser } = s.config;
    const existingIdent = currentObservation.taxon && (
      _.find( currentObservation.identifications, i => (
        i.current
        && i.user.id === currentUser.id
        && i.taxon.id === currentObservation.taxon.id
      ) )
    );
    if (
      !currentObservation
      || !currentObservation.id
      || !currentObservation.taxon
      || !currentObservation.user
      || currentObservation.user.id === currentUser.id
      || ( currentObservation.taxon && !currentObservation.taxon.is_active )
      || existingIdent
    ) {
      return null;
    }
    dispatch( agreeingWithObservation( ) );
    return dispatch(
      agreeWithObservaiton( currentObservation )
    ).then( ( ) => {
      dispatch( stopAgreeingWithObservation( ) );
    } );
  };
}

function submitIdentificationWithConfirmation( identification, options = {} ) {
  return dispatch => {
    dispatch( loadingDiscussionItem( identification ) );
    const boundPostIdentification = ( ) => {
      dispatch( postIdentification( identification ) )
        .catch( ( ) => {
          dispatch( stopLoadingDiscussionItem( identification ) );
        } )
        .then( ( ) => {
          dispatch( fetchCurrentObservation( identification.observation ) ).then( ( ) => {
            $( ".ObservationModal:first" ).find( ".sidebar" ).scrollTop( $( window ).height( ) );
          } );
        } );
    };
    if ( options.confirmationText ) {
      dispatch( showAlert( options.confirmationText, {
        title: I18n.t( "heads_up" ),
        onConfirm: boundPostIdentification,
        onCancel: ( ) => {
          dispatch( stopLoadingDiscussionItem( identification ) );
          dispatch( addIdentification( ) );
        }
      } ) );
    } else {
      boundPostIdentification( );
    }
  };
}

const addID = ( taxon, observation, options = { } ) => (
  ( dispatch, getState ) => {
    const s = getState( );
    if ( options.agreedWith ) {
      const params = {
        taxon_id: options.agreedWith.taxon.id,
        observation_id: options.agreedWith.observation_id
      };
      dispatch( loadingDiscussionItem( options.agreedWith ) );
      dispatch( postIdentification( params ) )
        .catch( ( ) => {
          dispatch( stopLoadingDiscussionItem( options.agreedWith ) );
        } )
        .then( ( ) => {
          dispatch( fetchCurrentObservation( ) ).then( ( ) => {
            $( ".ObservationModal:first" ).find( ".sidebar" ).scrollTop( $( window ).height( ) );
          } );
          dispatch( fetchObservationsStats( ) );
        } );
    } else {
      const ident = {
        taxon_id: taxon.id,
        observation_id: s.config.testingApiV2 ? observation.uuid : observation.id
      };
      dispatch( submitIdentificationWithConfirmation( ident, {
        confirmationText: options.confirmationText
      } ) );
    }
  }
);

const setMapZoomLevel = mapZoomLevel => (
  ( dispatch, getState ) => {
    const state = getState( );
    dispatch( setConfig( { mapZoomLevel } ) );
    if ( _.isNumber( state.config.currentUser.preferred_identify_map_zoom_level ) ) {
      dispatch( updateSession( { preferred_identify_map_zoom_level: mapZoomLevel } ) );
    }
  }
);

const setMapZoomLevelLocked = locked => (
  ( dispatch, getState ) => {
    const state = getState( );
    dispatch( setConfig( { mapZoomLevelLocked: locked } ) );
    if ( locked ) {
      dispatch( updateSession( { preferred_identify_map_zoom_level: state.config.mapZoomLevel } ) );
    } else {
      dispatch( updateSession( { preferred_identify_map_zoom_level: null } ) );
    }
  }
);

const onSubmitIdentification = ( observation, identification, options = {} ) => (
  dispatch => {
    const ident = {
      ...identification,
      observation
    };
    dispatch( loadingDiscussionItem( ident ) );
    const boundPostIdentification = disagreement => {
      const params = { ...ident };
      if ( _.isNil( ident.disagreement ) ) {
        params.disagreement = disagreement || false;
      }
      dispatch( updateCurrentObservation( { tab: "info" } ) );
      dispatch( postIdentification( params ) )
        .catch( ( ) => {
          dispatch( stopLoadingDiscussionItem( ident ) );
        } )
        .then( ( ) => {
          dispatch( updateEditorContent( "obsIdentifyIdComment", "" ) );
          dispatch( fetchCurrentObservation( observation ) ).then( ( ) => {
            $( ".ObservationModal:first" ).find( ".sidebar" ).scrollTop( $( window ).height( ) );
          } );
          dispatch( fetchObservationsStats( ) );
        } );
    };
    if ( options.confirmationText ) {
      dispatch( showAlert( options.confirmationText, {
        title: I18n.t( "heads_up" ),
        onConfirm: boundPostIdentification,
        onCancel: ( ) => {
          dispatch( stopLoadingDiscussionItem( ident ) );
          dispatch( addIdentification( ) );
        }
      } ) );
    } else if ( options.potentialDisagreement ) {
      const o = options.observation;
      let observationTaxon = o.taxon;
      if (
        o.preferences.prefers_community_taxon === false
        || o.user.preferences.prefers_community_taxa === false
      ) {
        observationTaxon = o.community_taxon || o.taxon;
      }
      dispatch( showDisagreementAlert( {
        onDisagree: ( ) => {
          boundPostIdentification( true );
        },
        onBestGuess: boundPostIdentification,
        onCancel: ( ) => {
          dispatch( stopLoadingDiscussionItem( ident ) );
          dispatch( addIdentification( ) );
        },
        oldTaxon: observationTaxon,
        newTaxon: options.taxon
      } ) );
    } else {
      boundPostIdentification( );
    }
  }
);

const chooseSuggestedTaxon = ( taxon, options = { } ) => (
  ( dispatch, getState ) => {
    const s = getState( );
    const { observation } = options;
    const params = {
      observation_id: s.config.testingApiV2 ? observation.uuid : observation.id,
      taxon_id: taxon.id,
      vision: options.vision
    };
    dispatch( onSubmitIdentification( observation, params, {
      observation,
      taxon,
      potentialDisagreement: isDisagreement( observation, taxon )
    } ) );
  }
);

export {
  POST_IDENTIFICATION,
  AGREEING_WITH_OBSERVATION,
  STOP_AGREEING_WITH_OBSERVATION,
  postIdentification,
  agreeWithObservaiton,
  agreeWithCurrentObservation,
  agreeingWithObservation,
  stopAgreeingWithObservation,
  updateIdentification,
  submitIdentificationWithConfirmation,
  addID,
  chooseSuggestedTaxon,
  setMapZoomLevel,
  setMapZoomLevelLocked,
  onSubmitIdentification
};
