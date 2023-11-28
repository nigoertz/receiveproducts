sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "../model/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, History, formatter, Fragment, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    return BaseController.extend("com.generalgoods.mm.gtwo.receiveproducts.receiveproducts.controller.Object", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the worklist controller is instantiated.
         * @public
         */
        onInit : function () {
            // Model used to manipulate control states. The chosen values make sure,
            // detail page shows busy indication immediately so there is no break in
            // between the busy indication for loading the view's meta data
            var oViewModel = new JSONModel({
                    busy : true,
                    delay : 0
                });
            this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
            this.setModel(oViewModel, "objectView");
        },
        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */


        /**
         * Event handler  for navigating back.
         * It there is a history entry we go one step back in the browser history
         * If not, it will replace the current entry of the browser history with the worklist route.
         * @public
         */
        onNavBack : function() {
            var sPreviousHash = History.getInstance().getPreviousHash();
            if (sPreviousHash !== undefined) {
                // eslint-disable-next-line fiori-custom/sap-no-history-manipulation
                history.go(-1);
            } else {
                this.getRouter().navTo("worklist", {}, true);
            }
        },

        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */

        /**
         * Binds the view to the object path.
         * @function
         * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
         * @private
         */
        _onObjectMatched : function (oEvent) {
            var sBelegnummer =  oEvent.getParameter("arguments").Belegnummer;
            this._bindView(`/LieferungenSet('${sBelegnummer}')`);
        },

        /**
         * Binds the view to the object path.
         * @function
         * @param {string} sObjectPath path to the object to be bound
         * @private
         */
        _bindView : function (sObjectPath) {
            var oViewModel = this.getModel("objectView");

            this.getView().bindElement({
                path: sObjectPath,
                events: {
                    change: this._onBindingChange.bind(this),
                    dataRequested: function () {
                        oViewModel.setProperty("/busy", true);
                    },
                    dataReceived: function () {
                        oViewModel.setProperty("/busy", false);
                    }
                }
            });
        },

        _onBindingChange : function () {
            var oView = this.getView(),
                oViewModel = this.getModel("objectView"),
                oElementBinding = oView.getElementBinding();

            // No data for the binding
            if (!oElementBinding.getBoundContext()) {
                this.getRouter().getTargets().display("objectNotFound");
                return;
            }

            var oResourceBundle = this.getResourceBundle(),
                oObject = oView.getBindingContext().getObject(),
                sObjectId = oObject.Belegnummer,
                sObjectName = oObject.LieferungenSet;

                oViewModel.setProperty("/busy", false);
                oViewModel.setProperty("/shareSendEmailSubject",
                oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
                oViewModel.setProperty("/shareSendEmailMessage",
                oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
        },

        openGoodsMovementDialog: function () {
            // In der Object.view.xml selektierte Row holen 
            let oSelectedItem = this.byId("objectInnerTable").getSelectedItem();

            // Wurde überhaupt eine Row selektiert?
            if (oSelectedItem) {
                
                console.log(this);

                // Der Dialog kann geschlossen werden
                if (this._gmDialog) {
                    this._gmDialog.destroy();
                    this._gmDialog = undefined;
                }

                // Dialog-Fragment holen
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.generalgoods.mm.gtwo.receiveproducts.receiveproducts.fragments.GoodsMovementDialog",
                    type: "XML",
                    controller: this,
                }).then((oDialog) => {
                    // Fragment zur View hinzufügen
                    this.getView().addDependent(oDialog);
                    this._gmDialog = oDialog;

                    // Daten für den Dialog vorbereiten
                    let oModel = this.getModel();
                    let sPath = this.getView().getBindingContext().getPath();
                    let oViewData = oModel.getProperty(sPath);
                    let sItemPath = oSelectedItem.getBindingContext().getPath();
                    let oItemData = oModel.getProperty(sItemPath);

                    // Neue Einträge im Model erstellen
                    let oBindingContext = oModel.createEntry(
                        "/WareneingangSet",
                        {
                            properties: {
                                Belegnummer: oViewData.Belegnummer,
                                Positionsnummer: oItemData.Positionsnummer,
                                Liefermenge: 0
                            },
                            success: (oData) => {
                                MessageToast.show(
                                    this.getResourceBundle().getText(
                                        // Nice, alles hat geklappt -> siehe i18n für Übersetzung
                                        "mt.success.gm"
                                    )
                                );

                                // SmartTable refresh um die neuen Daten anzuzeigen
                                this.getView().setBusy(false);
                                this.byId("objectTable").rebindTable(
                                    true
                                );
                            },
                            error: (oError) => {
                                // Änderungen zurücksetzen, Error in die Console schreiben
                                oModel.resetChanges();
                                this.getView().setBusy(false);
                                console.log(oError);
                            },
                        }
                    );

                    oDialog.setBindingContext(oBindingContext);
                    oDialog.open();
                });
            } else {
                MessageBox.error(
                    this.getResourceBundle().getText(
                        // Es wurde keine Row selektiert -> siehe i18n für Übersetzung
                        "mb.error.noSelection"
                    )
                );
            }
        },

        onCancelGoodsMovement: function () {

            // Dialog vollständig wegschießen (schließen, destroyen und auf undefined setzen)
            this._gmDialog.close();
            this._gmDialog.destroy();
            this._gmDialog = undefined;

            // oModel Änderungen verwerfen (sollten Änderungen vorhanden sein)
            let oModel = this.getModel();

            if (oModel.hasPendingChanges()) {
                oModel.resetChanges();
            }
        },

        createGoodsMovement: function() {
            let oModel = this.getView().getModel();
            let sPath = this.byId("dGoodsMovement").getBindingContext().getPath();
            let oGMData = oModel.getProperty(sPath);
            let bValidated = true;
            
            // Wurden die Felder gültig gefüllt? -> Nein? Validierung = false
            if (!oGMData.Belegnummer) {
                bValidated = false;
            }
            if (!oGMData.Positionsnummer) {
                bValidated = false;
            }
            if (!oGMData.Liefermenge) {
                bValidated = false;
            }

            // Der Dialog kann geschlossen werden, wenn die Validierung ok ist,
            // Die Änderungen werden über das oModel "gepushed"
            if (bValidated) {
                this.getView().setBusy(true);
                this._gmDialog.close();
                this._gmDialog.destroy();
                this._gmDialog = undefined;

                oModel.submitChanges();
            } else {
                MessageBox.error(
                    this.getResourceBundle().getText(
                        // Validierung fehlgeschlagen -> siehe i18n für Übersetzung
                        "mb.error.requiredFields"
                    )
                );
            }
        }
        
    });
});
