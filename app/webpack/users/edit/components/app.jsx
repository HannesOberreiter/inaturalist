import React, { Component } from "react";
import PropTypes from "prop-types";

import AlertModalContainer from "../../../shared/containers/alert_modal_container";
import Menu from "./menu";
import AccountContainer from "../containers/account_container";
import ContentContainer from "../containers/content_container";
import ErrorBoundary from "../../../shared/components/error_boundary";
import ProfileContainer from "../containers/profile_container";
import NotificationsContainer from "../containers/notifications_container";
import SaveButtonContainer from "../containers/save_button_container";
import ApplicationsContainer from "../containers/applications_container";
import RelationshipsContainer from "../containers/relationships_container";
import RevokeAccessModalContainer from "../containers/revoke_access_modal_container";
import CreativeCommonsLicensingModalContainer from "../containers/cc_licensing_modal_container";
import DropdownMenuMobile from "./dropdown_menu_mobile";
import DeleteRelationshipModalContainer from "../containers/delete_relationship_modal_container";
import ConfirmModalContainer from "../../../shared/containers/confirm_modal_container";

class App extends Component {
  constructor( ) {
    super( );

    this.handleInputChange = this.handleInputChange.bind( this );
  }

  componentDidMount( ) {
    window.addEventListener( "beforeunload", this.handleUnload );
  }

  componentWillUnmount( ) {
    window.removeEventListener( "beforeunload", this.handleUnload );
  }

  handleUnload( e ) {
    if ( !this.props ) return;
    const { userSettings } = this.props;

    if ( userSettings?.saved_status === "unsaved" ) {
      // preventing default within this if statement makes this work on both Chrome and Firefox
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event#browser_compatibility
      e.preventDefault( );
      // Chrome requires returnValue to be set
      e.returnValue = "";
    } else {
      delete e.returnValue;
    }
  }

  handleInputChange( e ) {
    const { setContainerIndex } = this.props;
    const i = Number( e.target.value );
    setContainerIndex( i );
  }

  render( ) {
    const { setContainerIndex, section } = this.props;

    const userSettings = [
      <ErrorBoundary key="ProfileContainerErrorBoundary"><ProfileContainer /></ErrorBoundary>,
      <ErrorBoundary key="AccountContainerErrorBoundary"><AccountContainer /></ErrorBoundary>,
      <ErrorBoundary key="NotificationsContainerErrorBoundary"><NotificationsContainer /></ErrorBoundary>,
      <ErrorBoundary key="RelationshipsContainerErrorBoundary"><RelationshipsContainer /></ErrorBoundary>,
      <ErrorBoundary key="ContentContainerErrorBoundary"><ContentContainer /></ErrorBoundary>,
      <ErrorBoundary key="ApplicationsContainerErrorBoundary"><ApplicationsContainer /></ErrorBoundary>
    ];

    return (
      <div className="container" id="UserSettings">
        <div className="settings-head row vertical-align">
          <div className="h1col col-xs-12 col-sm-6">
            <h1>{I18n.t( "settings" )}</h1>
          </div>
          <div className="btncol col-xs-12 col-sm-6">
            <SaveButtonContainer />
          </div>
          <div className="navcol col-xs-12 visible-xs settings-item">
            <ErrorBoundary>
              <DropdownMenuMobile menuIndex={section} handleInputChange={this.handleInputChange} />
            </ErrorBoundary>
          </div>
        </div>
        <div className="settings-body row">
          <div className="col-sm-2 menu hidden-xs">
            <ErrorBoundary>
              <Menu setContainerIndex={setContainerIndex} currentContainer={section} />
            </ErrorBoundary>
          </div>
          <div className="col-sm-1 hidden-xs">
            <div className="vl" />
          </div>
          <div className="col-sm-9">
            { userSettings[section] }
          </div>
        </div>
        <div className="settings-foot row vertical-align">
          <div className="col-xs-12">
            <SaveButtonContainer />
          </div>
        </div>
        <RevokeAccessModalContainer />
        <CreativeCommonsLicensingModalContainer />
        <DeleteRelationshipModalContainer />
        <ConfirmModalContainer />
        <AlertModalContainer />
      </div>
    );
  }
}

App.propTypes = {
  section: PropTypes.number,
  setContainerIndex: PropTypes.func,
  userSettings: PropTypes.object
};

export default App;
