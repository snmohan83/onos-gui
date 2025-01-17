/*
 * SPDX-FileCopyrightText: 2020-present Open Networking Foundation <info@opennetworking.org>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Inject, Injectable} from '@angular/core';
import {
    ConfigAdminServiceClient
} from './onos/config/admin/AdminServiceClientPb';
import {
    CompactChangesRequest, CompactChangesResponse,
    ListModelsRequest, ListConfigurationsRequest,
    ModelInfo,
    RollbackRequest,
    RollbackResponse
} from './onos/config/admin/admin_pb';
import * as grpcWeb from 'grpc-web';
import {Configuration} from './onos/config/configuration/device/types_pb';
import * as google_protobuf_duration_pb from 'google-protobuf/google/protobuf/duration_pb';
import {Observable, Subscriber} from 'rxjs';

@Injectable()
export class OnosConfigAdminService {

    adminServiceClient: ConfigAdminServiceClient;

    constructor(
        private idToken: string,
        private onosConfigUrl: string
    ) {
        this.adminServiceClient = new ConfigAdminServiceClient(onosConfigUrl);

        console.log('Config Admin Url ', onosConfigUrl);
    }

    requestRollback(nwChangeName: string, rollbackComment?: string): Observable<RollbackResponse> {
        const rollbackReq = new RollbackRequest();
        rollbackReq.setName(nwChangeName);
        if (rollbackComment) {
            rollbackReq.setComment(rollbackComment);
        } else {
            rollbackReq.setComment('Rolled back from GUI');
        }
        const rollbackObs = new Observable<RollbackResponse>((observer: Subscriber<RollbackResponse>) => {
            const call = this.adminServiceClient.rollbackNetworkChange(rollbackReq, {
                Authorization: 'Bearer ' + this.idToken,
            }, (err, resp) => {
                if (err) {
                    observer.error(err);
                } else {
                    observer.next(resp);
                }
                call.on('error', (error: grpcWeb.Error) => {
                    observer.error(error);
                });
                call.on('end', () => {
                    observer.complete();
                });
                call.on('status', (status: grpcWeb.Status) => {
                    console.log('Rollback status', status.code, status.details, status.metadata);
                });
            });
        });
        console.log('network change', nwChangeName, 'rolled back');
        return rollbackObs;
    }

    requestListRegisteredModels(): Observable<ModelInfo> {
        const modelRequest = new ListModelsRequest();
        modelRequest.setVerbose(true);
        const stream = this.adminServiceClient.listRegisteredModels(modelRequest, {
            Authorization: 'Bearer ' + this.idToken,
        });
        console.log('ListRegisteredModels sent to', this.onosConfigUrl);

        const modelsObs = new Observable<ModelInfo>((observer: Subscriber<ModelInfo>) => {
            stream.on('data', (modelInfo: ModelInfo) => {
                observer.next(modelInfo);
            });
            stream.on('error', (error: grpcWeb.Error) => {
                observer.error(error);
            });
            stream.on('end', () => {
                observer.complete();
            });
            return () => stream.cancel();
        });
        return modelsObs;
    }

    requestConfigurations(wildcard: string): Observable<Configuration> {
        const configurationsRequest = new ConfigurationsRequest();
        configurationsRequest.setSubscribe(true);
        configurationsRequest.setId(wildcard);
        const stream = this.adminServiceClient.listConfigurations(
            configurationsRequest, {
                Authorization: 'Bearer ' + this.idToken,
            }
        );
        console.log('ListConfigurations sent to', this.onosConfigUrl);

        const configurationObs = new Observable<Configuration>((observer: Subscriber<Configuration>) => {
            stream.on('data', (configuration: Configuration) => {
                observer.next(configuration);
            });
            stream.on('error', (error: grpcWeb.Error) => {
                observer.error(error);
            });
            stream.on('end', () => {
                observer.complete();
            });
            return () => stream.cancel();
        });
        return configurationObs;
    }

    requestCompactChanges(retensionSecs: number): Observable<CompactChangesResponse> {
        const retentionDuration = new google_protobuf_duration_pb.Duration();
        retentionDuration.setSeconds(retensionSecs);
        const compactRequest = new CompactChangesRequest();
        compactRequest.setRetentionPeriod(retentionDuration);
        console.log('Compacting changes older than', retensionSecs, 'second(s)');
        const compactchangesObs = new Observable<CompactChangesResponse>((observer: Subscriber<CompactChangesResponse>) => {
            const call = this.adminServiceClient.compactChanges(compactRequest, {
                Authorization: 'Bearer ' + this.idToken,
            }, (err, resp) => {
                if (err) {
                    observer.error(err);
                } else {
                    observer.next(resp);
                }
            });
            call.on('error', (error: grpcWeb.Error) => {
                observer.error(error);
            });
            call.on('end', () => {
                observer.complete();
            });
            call.on('status', (status: grpcWeb.Status) => {
                console.log('Compact changes status', status.code, status.details, status.metadata);
            });
        });
        return compactchangesObs;
    }
}
